import { ImageResponse } from "next/og";
import { BRAND, OG_SIZE } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The card that appears when a link is pasted into Slack, Discord or a tweet.
 * Generated rather than committed as a PNG so it follows the brand constants
 * and never drifts from the product name.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: BRAND.color.dark,
          // Satori supports only a narrow slice of gradient syntax: an
          // explicit shape and position, with plain colour stops.
          backgroundImage: `radial-gradient(circle at 12% 0%, ${BRAND.color.iris}55, transparent 55%), radial-gradient(circle at 100% 100%, ${BRAND.color.cyan}33, transparent 50%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <g stroke={BRAND.color.iris} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 21v-4.5" />
              <path d="M7.5 16.5v-3a3 3 0 0 1 3-3h6" />
              <path d="M7.5 10.5V6" />
            </g>
            <circle cx="18" cy="10.5" r="1.8" fill={BRAND.color.cyan} />
          </svg>
          <div style={{ display: "flex", fontSize: 34, color: "#e8e6f5", letterSpacing: -0.5 }}>
            <span style={{ fontWeight: 700 }}>{BRAND.wordmark.lead}</span>
            <span style={{ color: BRAND.color.iris, fontWeight: 700 }}>/</span>
            <span style={{ fontWeight: 700 }}>{BRAND.wordmark.tail}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, color: "#ffffff", fontWeight: 700, letterSpacing: -2, maxWidth: 940 }}>
            Find an open source issue that actually fits you.
          </div>
          <div style={{ fontSize: 30, color: "#a9a4c7", maxWidth: 900 }}>
            Matched by language, level and interest. Then guided, one command at a time.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#7d78a3" }}>
          <span>{BRAND.domain}</span>
        </div>
      </div>
    ),
    size,
  );
}
