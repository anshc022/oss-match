import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon. iOS ignores transparency, so the plate is drawn in. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.color.dark,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <g stroke={BRAND.color.iris} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 21v-4.5" />
            <path d="M7.5 16.5v-3a3 3 0 0 1 3-3h6" />
            <path d="M7.5 10.5V6" />
          </g>
          <circle cx="18" cy="10.5" r="1.6" fill={BRAND.color.cyan} />
        </svg>
      </div>
    ),
    size,
  );
}
