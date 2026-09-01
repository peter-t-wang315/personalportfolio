import { ImageResponse } from "next/og";
import { site } from "@/content";
import { palette } from "@/lib/palette";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: palette.paper,
          color: palette.ink,
        }}
      >
        <div style={{ fontSize: 28, color: palette.inkMuted }}>{site.role}</div>
        <div style={{ fontSize: 64, marginTop: 24, maxWidth: 900 }}>
          {site.positioning}
        </div>
      </div>
    ),
    { ...size },
  );
}
