
import { uniform, vec2, vec3, float, Fn, screenUV, time, fract, sin, dot, mix, smoothstep, length } from 'three/tsl';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';

/**
 * Cheap hash-based white noise, reused from the same family of hash
 * functions as blackhole-shader.js so the whole project shares one
 * "randomness" idiom instead of mixing noise styles.
 */
const grainHash = Fn(([p]) => {
  const n = sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453);
  return fract(n);
});

/**
 * Builds the post-FX uniform set. Call once; reuse the returned object's
 * `.value` properties to update from the UI.
 */
export function createPostFXUniforms(config) {
  return {
    vignetteStrength: uniform(config.vignetteStrength ?? 0.45),
    vignetteRadius: uniform(config.vignetteRadius ?? 0.75),
    vignetteSoftness: uniform(config.vignetteSoftness ?? 0.45),
    chromaticAberration: uniform(config.chromaticAberration ?? 0.35),
    filmGrainAmount: uniform(config.filmGrainAmount ?? 0.05),
    filmGrainSize: uniform(config.filmGrainSize ?? 1.6),
  };
}

/**
 * Applies vignette + film grain to a color node (vec3 or vec4 color term).
 * Chromatic aberration is handled separately (see applyChromaticAberration)
 * because it needs to resample the source texture, not just tint a color.
 */
function applyVignetteAndGrain(colorNode, fx) {
  return Fn(() => {
    const uv = screenUV;
    const centered = uv.sub(0.5);

    // --- Vignette ---
    // Radial darkening from screen center. `vignetteRadius` controls where
    // the darkening starts, `vignetteSoftness` controls how gradual the
    // falloff is, `vignetteStrength` controls how dark the corners get.
    const dist = length(centered);
    const vignette = float(1.0).sub(
      smoothstep(fx.vignetteRadius, fx.vignetteRadius.add(fx.vignetteSoftness).max(fx.vignetteRadius.add(0.001)), dist)
        .mul(fx.vignetteStrength)
    );

    // --- Film grain ---
    // Time-varying hashed noise, scaled by filmGrainSize so it reads as
    // sensor grain rather than a static dither pattern. Centered around 0
    // and added rather than multiplied so it doesn't crush shadows to black.
    const grainUV = uv.mul(fx.filmGrainSize).mul(800.0);
    const grain = grainHash(grainUV.add(time.mul(60.0))).sub(0.5).mul(fx.filmGrainAmount).mul(2.0);

    const graded = colorNode.toVec3().mul(vignette).add(vec3(grain, grain, grain));
    return graded;
  })();
}

/**
 * Builds the full post-FX output node given the scene's rendered color
 * (already including bloom). Returns a node ready to assign to
 * postProcessing.outputNode.
 *
 * @param {object} sceneColorTextureNode - texture node from a `pass(...)`, post-bloom
 * @param {object} fx - uniforms from createPostFXUniforms()
 */
export function applyPostFX(sceneColorTextureNode, fx) {
  // Chromatic aberration resamples the texture at offset UVs per-channel,
  // so it has to run on the texture node directly.
  const aberrated = chromaticAberration(sceneColorTextureNode, fx.chromaticAberration, vec2(0.5, 0.5), 1.1);

  // Vignette + grain run as a color-grading pass on top of that result.
  return applyVignetteAndGrain(aberrated, fx);
}
