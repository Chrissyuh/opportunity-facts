import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#b33a2b",
          border: "5px solid #16211d",
          color: "#fffaf2",
          display: "flex",
          fontFamily: "Georgia, serif",
          fontSize: 25,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: "-1px",
          width: "100%",
        }}
      >
        OF
      </div>
    ),
    size,
  );
}
