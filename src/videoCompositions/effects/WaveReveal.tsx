import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {useEffect, useRef} from "react";

const variant: Variants = 'trTbl-reveal'


type Variants = 'blTtr-cover' | 'trTbl-reveal'
const front = variant == 'blTtr-cover' ? '-0.18 + time * 2.45' : '2.18 - time * 2.45'

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
  float swell = sin(uv.y * 7.0 + time * 4.2) * 0.06;
  float ripple = sin(uv.y * 19.0 - time * 8.0) * 0.018;
  float drift = noise(vec2(uv.y * 4.0, time * 1.6)) * 0.07 - 0.035;
  float diagonal = uv.x + uv.y + swell + ripple + drift;
  float front = ${front};

  float cover = 1.0 - smoothstep(front - 0.03, front + 0.035, diagonal);
  float edge = 1.0 - smoothstep(0.0, 0.11, abs(diagonal - front));
  float innerEdge = 1.0 - smoothstep(0.0, 0.036, abs(diagonal - front));
  float foam = noise(vec2(uv.y * 30.0, time * 12.0 + uv.x * 8.0)) * 0.24;

  float coverAlpha = cover * 0.94 * strength;
  float edgeAlpha = edge * (0.22 + foam) * strength;
  float innerAlpha = innerEdge * 0.44 * strength;
  float alpha = max(coverAlpha, max(edgeAlpha, innerAlpha));

  vec3 coverColor = vec3(0.05, 0.07, 0.10);
  vec3 edgeColor = vec3(0.68, 0.82, 1.00);
  vec3 color = mix(
    coverColor,
    edgeColor,
    min(1.0, edge * 0.75 + innerEdge * 0.65)
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
    const introStart = 0;
    const introEnd = 34;
    const localTime = interpolate(frame, [introStart, introEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rampDown = interpolate(frame, [introEnd - 4, introEnd], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const strength = rampDown;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLoc, localTime);
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
