"use client";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-64 h-64 text-blue-900" }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
    >
      <title>The Will of the People</title>

      {/* Title text */}
      <text
        x="50%"
        y="100"
        textAnchor="middle"
        fontSize="64"
        fontWeight="bold"
        fill="currentColor"
      >
        The Will of the People
      </text>

      {/* Leader */}
      <g fill="#0D3B66">
        <rect x="450" y="740" width="140" height="200" rx="20" />
        <circle cx="520" cy="680" r="60" />
        {/* Hair detail */}
        <path d="M480 650 Q520 600 560 650" fill="#092947" />
        {/* Smaller ear */}
        <circle cx="570" cy="680" r="10" fill="#0D3B66" />
      </g>

      {/* Crowd heads */}
      <g fill="#B0B0B0" stroke="#0D3B66" strokeWidth="6">
        <circle cx="200" cy="600" r="50" />
        <circle cx="340" cy="620" r="50" />
        <circle cx="680" cy="600" r="50" />
        <circle cx="820" cy="620" r="50" />
        <circle cx="260" cy="480" r="45" />
        <circle cx="420" cy="500" r="45" />
        <circle cx="600" cy="480" r="45" />
        <circle cx="760" cy="500" r="45" />
        <circle cx="360" cy="380" r="40" />
        <circle cx="520" cy="360" r="40" />
        <circle cx="680" cy="380" r="40" />
      </g>

      {/* Raised hands (scattered, not majority) */}
      <rect x="330" y="200" width="30" height="140" fill="#3C9D6D" />
      <rect x="690" y="220" width="30" height="140" fill="#0D3B66" />
      <rect x="220" y="300" width="25" height="120" fill="#3C9D6D" />
    </svg>
  );
}