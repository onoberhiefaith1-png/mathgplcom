import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  userName?: string
  confirmationUrl: string
}

export const InviteEmail = ({ userName, confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview="You have been invited to join MathGPL">
    <Heading style={styles.h1}>You have been invited to MathGPL</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      You have been invited to join MathGPL. Accept the invitation below to set up your account
      and get started.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Accept Invitation
    </Button>
    <Text style={styles.fallback}>
      If the button does not work, copy and paste this address into your browser:
      <br />
      {confirmationUrl}
    </Text>
    <Text style={styles.small}>
      If you were not expecting this invitation, you can safely ignore this email.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default InviteEmail
