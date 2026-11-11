import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, FallbackLink, greeting, styles } from './brand'

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  userName?: string
  confirmationUrl: string
}

export const InviteEmail = ({ userName, confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview="You have been invited to join Mathemagine">
    <Heading style={styles.h1}>You have been invited to Mathemagine</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      You have been invited to join Mathemagine. Accept the invitation below to set up your account
      and get started.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Accept Invitation
    </Button>
    <FallbackLink url={confirmationUrl} />
    <Text style={styles.small}>
      If you were not expecting this invitation, you can safely ignore this email.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The Mathemagine Team
    </Text>
  </EmailShell>
)

export default InviteEmail
