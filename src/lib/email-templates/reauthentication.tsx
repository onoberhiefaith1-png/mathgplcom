import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'

interface ReauthenticationEmailProps {
  userName?: string
  token: string
}

export const ReauthenticationEmail = ({ userName, token }: ReauthenticationEmailProps) => (
  <EmailShell preview="Your Mathemagine verification code">
    <Heading style={styles.h1}>Your verification code</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      Enter this code in Mathemagine to confirm it is really you:
    </Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.small}>
      The code expires shortly. Never share it with anyone. If you did not request it, you can
      safely ignore this email.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The Mathemagine Team
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
