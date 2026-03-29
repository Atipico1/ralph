import { ImageResponse } from 'next/og';

export const alt = 'ALJALDAKKALSEN - AI Agent Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <span
          style={{
            fontSize: '120px',
            fontWeight: 700,
            color: '#18181b',
            letterSpacing: '-0.04em',
          }}
        >
          ALJALDAKKALSEN
        </span>
        <span
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: '#a1a1aa',
            marginTop: '16px',
          }}
        >
          무엇을 도와드릴까요?
        </span>
      </div>
    ),
    { ...size },
  );
}
