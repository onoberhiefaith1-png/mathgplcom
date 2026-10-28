import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

/**
 * The administrator-authored platform message.
 *
 * Every email the Email Dashboard sends uses this shell: subject, body, footer
 * and signature come from the saved template the administrator edits, so the
 * wording can change without a code change.
 */
interface Props {
  subject?: string
  body?: string
  footer?: string
  signature?: string
  senderName?: string
  headingColor?: string
  textColor?: string
  buttonColor?: string
  buttonLabel?: string
  buttonUrl?: string
  logoText?: string
}

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px 40px',
}

export const PlatformMessageEmail = ({
  subject = '',
  body = '',
  footer = '',
  signature = '',
  senderName = 'MathGPL',
  headingColor = '#141A3D',
  textColor = '#3A3F55',
  buttonColor = '#E9A32B',
  buttonLabel = '',
  buttonUrl = 'https://mathgpl.com',
  logoText = 'MathGPL',
}: Props) => {
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || logoText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ margin: '0 0 18px', fontSize: '20px', fontWeight: 'bold', color: headingColor }}>
            {logoText}
          </Text>
          {subject ? (
            <Heading style={{ margin: '0 0 16px', fontSize: '22px', color: headingColor }}>
              {subject}
            </Heading>
          ) : null}
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={{ fontSize: '15px', lineHeight: '24px', color: textColor }}>
              {paragraph}
            </Text>
          ))}
          {buttonLabel ? (
            <Button
              href={buttonUrl}
              style={{
                backgroundColor: buttonColor,
                color: '#141A3D',
                borderRadius: '10px',
                padding: '12px 22px',
                fontWeight: 'bold',
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              {buttonLabel}
            </Button>
          ) : null}
          {signature ? (
            <Text style={{ fontSize: '15px', lineHeight: '24px', color: textColor }}>{signature}</Text>
          ) : null}
          <Hr style={{ borderColor: '#E6E8EF', margin: '28px 0 14px' }} />
          <Text style={{ fontSize: '12px', lineHeight: '20px', color: '#7A7F91' }}>
            {footer || senderName}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PlatformMessageEmail,
  subject: (data: Record<string, any>) => (data['subject'] as string) || 'A message from MathGPL',
  displayName: 'Platform message',
  previewData: {
    subject: 'A message from MathGPL',
    body: 'Hello,\n\nThis is how a message from the Email Dashboard looks to the people who receive it.',
    footer: 'You are receiving this because you have a MathGPL account.',
    signature: 'The MathGPL Team',
    senderName: 'MathGPL',
    buttonLabel: 'Open MathGPL',
  },
} satisfies TemplateEntry

export default PlatformMessageEmail
