import type { SVGProps } from 'react';

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
} as const;

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export function StepIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 5l9 7-9 7zM16 5h3v14h-3z" />
    </svg>
  );
}

export function RestartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
    </svg>
  );
}
