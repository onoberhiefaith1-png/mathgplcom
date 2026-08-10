import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'

interface Props {
  userName?: string | undefined
  mathgplId: string
  email: string
  loginUrl?: string
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

/** Sent when somebody uses "Forgot MathGPL ID". */
export const AccountIdEmail = ({ userName, mathgplId, email, loginUrl = 'https://mathgpl.com/login' }: Props) => (
  <EmailShell preview="Your MathGPL ID">
    <Heading style={styles.h1}>Your MathGPL ID</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>You asked us to remind you of the MathGPL ID for this account.</Text>
    <div style={idBox}>
      <Text style={idLabel}>Your MathGPL ID</Text>
      <Text style={idValue}>{mathgplId}</Text>
      <Text style={styles.small}>
        You log in with this ID and your password. It is permanent and never changes.
      </Text>
    </div>
    <Text style={styles.text}>
      Registered email address: <strong>{email}</strong>
    </Text>
    <Button style={styles.button} href={loginUrl}>
      Log in to MathGPL
    </Button>
    <Text style={styles.small}>
      If you did not request this, you can safely ignore this email — your password was not changed.
    </Text>
  </EmailShell>
)

export default AccountIdEmail
