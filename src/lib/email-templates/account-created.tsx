import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'
import type { TemplateEntry } from './registry'

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

/** Sent once an account is confirmed, as the permanent record of the login ID. */
export const AccountCreatedEmail = ({
  userName,
  mathgplId,
  email,
  loginUrl = 'https://mathgpl.com/login',
}: Props) => (
  <EmailShell preview="Your MathGPL account has been created">
    <Heading style={styles.h1}>Your MathGPL account has been created</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>Your MathGPL account has been successfully created.</Text>
    <div style={idBox}>
      <Text style={idLabel}>Your MathGPL ID</Text>
      <Text style={idValue}>{mathgplId}</Text>
      <Text style={styles.small}>
        You will use this ID and your password to log in to MathGPL. Please keep it safe.
      </Text>
    </div>
    <Text style={styles.text}>
      Your registered email address is: <strong>{email}</strong>
    </Text>
    <Button style={styles.button} href={loginUrl}>
      Log in to MathGPL
    </Button>
    <Text style={styles.small}>
      If you did not create this account, please contact MathGPL support.
    </Text>
  </EmailShell>
)

export const template = {
  component: AccountCreatedEmail,
  subject: 'Your MathGPL Account Has Been Created',
  displayName: 'Account created',
  previewData: { userName: 'Faith', mathgplId: 'TCH/000123', email: 'teacher@example.com' },
} satisfies TemplateEntry

export default AccountCreatedEmail
