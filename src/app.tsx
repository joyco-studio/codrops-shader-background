import { useMemo } from 'react'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { shaderMaterial, useTrailTexture } from '@react-three/drei'
import { useMousetrap } from '@repo/global/hooks/use-mousetrap'
import * as THREE from 'three'
import { useListBlade, useSliderBlade, useTweakpane } from 'react-tweakpane'

// Custom shader material
const DotMaterial = shaderMaterial(
  {
    time: 0,
    resolution: new THREE.Vector2(),
    dotColor: new THREE.Color('#F2F2F2'),
    bgColor: new THREE.Color('#0344DC'),
    mouseTrail: null,
    render: 0,
    rotation: Math.PI / 4,
    gridSize: 80,
  },
  /* glsl */ `
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  /* glsl */ `
    uniform float time;
    uniform int render;
    uniform vec2 resolution;
    uniform vec3 dotColor;
    uniform vec3 bgColor;
    uniform sampler2D mouseTrail;
    uniform float rotation;
    uniform float gridSize;

    vec2 rotate(vec2 uv, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        mat2 rotationMatrix = mat2(c, -s, s, c);
        return rotationMatrix * (uv - 0.5) + 0.5;
    }

    vec2 coverUv(vec2 uv) {
      vec2 s = resolution.xy / max(resolution.x, resolution.y);
      vec2 newUv = (uv - 0.5) * s + 0.5;
      return clamp(newUv, 0.0, 1.0);
    }

    float sdfCircle(vec2 p, float r) {
        return length(p - 0.5) - r;
    }

    void main() {
      vec2 screenUv = gl_FragCoord.xy / resolution;
      vec2 uv = coverUv(screenUv);

      vec2 rotatedUv = rotate(uv, rotation);

      // Create a grid
      vec2 gridUv = fract(rotatedUv * gridSize);
      vec2 gridUvCenterInScreenCoords = rotate((floor(rotatedUv * gridSize) + 0.5) / gridSize, -rotation);

      // Calculate distance from the center of each cell
      float baseDot = sdfCircle(gridUv, 0.25);

      // Screen mask
      float screenMask = smoothstep(0.0, 1.0, 1.0 - uv.y); // 0 at the top, 1 at the bottom
      vec2 centerDisplace = vec2(0.7, 1.1);
      float circleMaskCenter = length(uv - centerDisplace);
      float circleMaskFromCenter = smoothstep(0.5, 1.0, circleMaskCenter);
      
      float combinedMask = screenMask * circleMaskFromCenter;
      float circleAnimatedMask = sin(time * 2.0 + circleMaskCenter * 10.0);

      // Mouse trail effect
      float mouseInfluence = texture2D(mouseTrail, gridUvCenterInScreenCoords).r;
      
      float scaleInfluence = max(mouseInfluence * 0.5, circleAnimatedMask * 0.3);

      // Create dots with animated scale, influenced by mouse
      float dotSize = min(pow(circleMaskCenter, 2.0) * 0.3, 0.3);

      float sdfDot = sdfCircle(gridUv, dotSize * (1.0 + scaleInfluence * 0.5));

      float smoothDot = smoothstep(0.05, 0.0, sdfDot);

      float dotOpacity = 0.05; /* Global dot opacity */
      float opacityInfluence = max(mouseInfluence * 1.5, circleAnimatedMask * 0.5);

      // Mix background color with dot color, using animated opacity to increase visibility
      vec3 composition = mix(bgColor, dotColor, smoothDot * combinedMask * dotOpacity * (1.0 + opacityInfluence * 3.5));

      if (render == 0) {
        gl_FragColor = vec4(composition, 1.0);
      } else if (render == 4) {
        gl_FragColor = vec4(vec3(circleAnimatedMask), 1.0);
      } else if (render == 3) {
        gl_FragColor = vec4(vec3(mouseInfluence), 1.0);
      } else if (render == 1) {
        gl_FragColor = vec4(gridUv, 0.0, 1.0);
      } else if (render == 2) {
        gl_FragColor = vec4(vec3(baseDot), 1.0);
      } else {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
)

function Scene() {
  const size = useThree((s) => s.size)
  const viewport = useThree((s) => s.viewport)
  const pane = useTweakpane()
  const [rotation] = useSliderBlade(pane, {
    label: 'Rotation',
    min: 0,
    max: Math.PI,
    value: Math.PI / 4,
  })
  const [gridSize] = useSliderBlade(pane, {
    label: 'Cells',
    min: 10,
    max: 100,
    value: 80,
  })
  const [output, setOutput] = useListBlade(pane, {
    label: 'Output',
    options: [
      {
        text: 'Grid',
        value: 1,
      },
      {
        text: 'Dots',
        value: 2,
      },
      {
        text: 'Mouse Influence',
        value: 3,
      },
      {
        text: 'Gradient',
        value: 4,
      },
      {
        text: 'Composition',
        value: 0,
      },
    ],
    value: 0,
  })

  const [trail, onMove] = useTrailTexture({
    size: 512,
    radius: 0.1,
    maxAge: 400,
    interpolate: 1,
    ease: function easeInOutCirc(x: number): number {
      return x < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2
    },
  })

  const dotMaterial = useMemo(() => {
    return new DotMaterial()
  }, [])

  useFrame((state) => {
    dotMaterial.uniforms.time.value = state.clock.elapsedTime
  })

  useMousetrap([
    {
      keys: '1',
      callback: () => {
        setOutput(1)
      },
    },
    {
      keys: '2',
      callback: () => {
        setOutput(2)
      },
    },
    {
      keys: '3',
      callback: () => {
        setOutput(3)
      },
    },
    {
      keys: '4',
      callback: () => {
        setOutput(4)
      },
    },
    {
      keys: '5',
      callback: () => {
        setOutput(0)
      },
    },
  ])

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    console.log('Pointer move:', e.uv?.x, e.uv?.y)
    onMove(e)
  }

  const scale = Math.max(viewport.width, viewport.height) / 2

  return (
    <mesh scale={[scale, scale, 1]} onPointerMove={handlePointerMove}>
      <planeGeometry args={[2, 2]} />
      <primitive
        object={dotMaterial}
        resolution={[size.width * viewport.dpr, size.height * viewport.dpr]}
        rotation={rotation}
        gridSize={gridSize}
        mouseTrail={trail}
        render={output}
      />
    </mesh>
  )
}

export default function DotScreenShader() {
  return (
    <Canvas
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.NoToneMapping,
      }}
    >
      <Scene />
    </Canvas>
  )
}
