import { ImageResponse } from "next/og";
import { site } from "@/content";

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
          backgroundColor: "#F7F5F0",
          color: "#171614",
        }}
      >
        <div style={{ fontSize: 28, color: "#5C5A54" }}>{site.role}</div>
        <div style={{ fontSize: 64, marginTop: 24, maxWidth: 900 }}>
          {site.positioning}
        </div>
      </div>
    ),
    { ...size },
  );
}
