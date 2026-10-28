import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, FallbackLink, greeting, styles } from './brand'

interface SignupEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  userName?: string
  mathgplId?: string | null
  confirmationUrl: string
}

const idBox: React.CSSProperties = {
  margin: '18px 0',
  padding: '16px 18px',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#f8fafc',
}

const idLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#64748b',
}

const idValue: React.CSSProperties = {
  margin: '6px 0 0',
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '2px',
  color: '#0f172a',
}

export const SignupEmail = ({ userName, mathgplId, confirmationUrl }: SignupEmailProps) => (
  <EmailShell preview="Confirm your MathGPL account to get started">
    <Heading style={styles.h1}>Welcome to MathGPL — confirm your account</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      Welcome to MathGPL! Your account has been successfully created.
    </Text>
    {mathgplId ? (
      <div style={idBox}>
        <Text style={idLabel}>Your MathGPL ID</Text>
        <Text style={idValue}>{mathgplId}</Text>
        <Text style={styles.small}>
          This is how you log in, together with your password. It never changes — please keep it
          safe.
        </Text>
      </div>
    ) : null}
    <Text style={styles.text}>
      To activate and secure your account, please confirm your email address using the button
      below.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm My Email
    </Button>
    <FallbackLink url={confirmationUrl} />

    <Text style={styles.small}>
      If you did not create this account, you can safely ignore this email.
    </Text>
    <Text style={styles.small}>
      For your security, do not share this verification link with anyone. It expires after a
      short time.
    </Text>
    <Text style={styles.text}>
      We look forward to helping you learn, teach and grow with MathGPL.
      <br />
      <br />
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default SignupEmail
