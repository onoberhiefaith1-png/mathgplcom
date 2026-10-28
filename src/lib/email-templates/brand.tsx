/**
 * Shared MathGPL shell for every account email.
 *
 * One header, one footer, one set of styles, so verification, password reset
 * and every other account email arrive looking like the same product.
 */
import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const BRAND = {
  navy: '#141A3D',
  ink: '#3A3F55',
  gold: '#E9A32B',
  goldInk: '#141A3D',
  muted: '#7A7F91',
  hairline: '#E6E8EF',
  site: 'https://mathgpl.com',
  support: 'support@mathgpl.com',
}

export const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
  container: { maxWidth: '560px', margin: '0 auto', padding: '32px 24px 40px' },
  wordmark: {
    fontSize: '22px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.5px',
    color: BRAND.navy,
    margin: '0 0 4px',
    textDecoration: 'none',
  },
  tagline: { fontSize: '12px', color: BRAND.muted, margin: '0 0 28px' },
  h1: {
    fontSize: '22px',
    fontWeight: 'bold' as const,
    color: BRAND.navy,
    lineHeight: '1.3',
    margin: '0 0 18px',
  },
  text: { fontSize: '15px', color: BRAND.ink, lineHeight: '1.6', margin: '0 0 18px' },
  small: { fontSize: '13px', color: BRAND.muted, lineHeight: '1.6', margin: '0 0 12px' },
  button: {
    display: 'block',
    backgroundColor: BRAND.gold,
    color: BRAND.goldInk,
    fontSize: '16px',
    fontWeight: 'bold' as const,
    borderRadius: '10px',
    padding: '14px 24px',
    textAlign: 'center' as const,
    textDecoration: 'none',
    margin: '8px 0 20px',
  },
  fallback: {
    fontSize: '12px',
    color: BRAND.muted,
    lineHeight: '1.6',
    wordBreak: 'break-all' as const,
    margin: '0 0 24px',
  },
  link: { color: BRAND.navy, textDecoration: 'underline' },
  fallbackLink: {
    color: BRAND.navy,
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  hr: { borderColor: BRAND.hairline, margin: '28px 0 16px' },
  footer: { fontSize: '12px', color: BRAND.muted, lineHeight: '1.7', margin: '0 0 6px' },
  code: {
    fontSize: '30px',
    fontWeight: 'bold' as const,
    letterSpacing: '6px',
    color: BRAND.navy,
    margin: '0 0 20px',
  },
}

/**
 * "Hello Faith," — the person's first name only, never the full name.
 * Falls back to a neutral greeting when no name is known.
 */
export function greeting(name?: string | null) {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return first ? `Hello ${first},` : 'Hello there,'
}

/**
 * The real confirmation address, shown as a genuinely clickable link so a
 * blocked button never leaves the recipient stranded.
 */
export const FallbackLink = ({ url }: { url: string }) => (
  <Text style={styles.fallback}>
    If the button does not work, copy and paste this address into your browser:
    <br />
    <Link href={url} style={styles.fallbackLink}>
      {url}
    </Link>
  </Text>
)

export const EmailShell = ({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section>
          <Link href={BRAND.site} style={styles.wordmark}>
            MathGPL
          </Link>
          <Text style={styles.tagline}>Educational technology platform</Text>
        </Section>
        {children}
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          MathGPL — Educational technology platform
          <br />
          <Link href={BRAND.site} style={styles.link}>
            mathgpl.com
          </Link>
        </Text>
        <Text style={styles.footer}>
          <Link href={`${BRAND.site}/privacy`} style={styles.link}>
            Privacy Policy
          </Link>
          {'  ·  '}
          <Link href={`${BRAND.site}/terms`} style={styles.link}>
            Terms of Service
          </Link>
          {'  ·  '}
          <Link href={`mailto:${BRAND.support}`} style={styles.link}>
            {BRAND.support}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)
