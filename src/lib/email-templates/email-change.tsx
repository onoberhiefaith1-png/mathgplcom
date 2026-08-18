import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, FallbackLink, greeting, styles } from './brand'

interface EmailChangeEmailProps {
  siteName?: string
  userName?: string
  /** The recipient address of this message. */
  email?: string
  /** The address currently on the account. */
  oldEmail?: string
  /** The address being confirmed — this email's recipient. */
  newEmail?: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  userName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell preview="Confirm your new MathGPL email address">
    <Heading style={styles.h1}>Confirm your new email address</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      We received a request to change the email address on your MathGPL account
      {oldEmail ? ` from ${oldEmail}` : ''}
      {newEmail ? ` to ${newEmail}` : ''}.
    </Text>
    <Text style={styles.text}>Confirm the change using the button below.</Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm New Email
    </Button>
    <FallbackLink url={confirmationUrl} />
    <Text style={styles.small}>
      If you did not request this change, you can safely ignore this email and your address stays
      as it is. For help, contact MathGPL Support.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default EmailChangeEmail
