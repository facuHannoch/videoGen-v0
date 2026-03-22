import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {useEffect, useRef} from "react";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float time;
uniform vec2 resolution;
uniform float strength;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 centered = uv - 0.5;
  centered.x *= resolution.x / resolution.y;

  float sweep = smoothstep(-0.35, 0.45, uv.x + time * 1.8);
  float trail = 1.0 - smoothstep(0.05, 0.42, abs((uv.x - 0.5) - (0.34 - time * 1.4)));
  float grain = noise(uv * 7.0 + vec2(time * 2.2, -time * 1.4));
  float wave = sin((uv.y * 12.0) - time * 8.0 + grain * 2.0) * 0.5 + 0.5;
  float vignette = 1.0 - smoothstep(0.25, 0.86, length(centered));

  float alpha = strength * sweep * trail * (0.45 + wave * 0.55) * vignette;
  vec3 color = mix(
    vec3(0.04, 0.11, 0.28),
    vec3(0.30, 0.56, 0.95),
    wave
  );

  gl_FragColor = vec4(color, alpha);
}
`;

type GlState = {
  gl: WebGLRenderingContext;
  timeLoc: WebGLUniformLocation;
  resLoc: WebGLUniformLocation;
  strengthLoc: WebGLUniformLocation;
};

export const ScreenSweepShader = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || glRef.current) {
      return;
    }

    const gl = canvas.getContext("webgl", {premultipliedAlpha: false});
    if (!gl) {
      return;
    }

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error("Could not create shader");
      }

      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram();
    if (!program) {
      throw new Error("Could not create shader program");
    }

    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    glRef.current = {
      gl,
      timeLoc: gl.getUniformLocation(program, "time")!,
      resLoc: gl.getUniformLocation(program, "resolution")!,
      strengthLoc: gl.getUniformLocation(program, "strength")!,
    };
  }, []);

  useEffect(() => {
    const ctx = glRef.current;
    if (!ctx) {
      return;
    }

    const {gl, timeLoc, resLoc, strengthLoc} = ctx;
    const time = frame / fps;

    const introStart = 4;
    const introPeak = 15;
    const introEnd = 30;
    const rampUp = interpolate(frame, [introStart, introPeak], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rampDown = interpolate(frame, [introPeak, introEnd], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const strength = Math.min(rampUp, rampDown) * 0.75;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLoc, time);
    gl.uniform2f(resLoc, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(strengthLoc, strength);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [frame, fps]);

  return (
    <AbsoluteFill style={{pointerEvents: "none", zIndex: 12}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: "100%", height: "100%"}}
      />
    </AbsoluteFill>
  );
};
