package com.example.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

/**
 * Child Privacy, COPPA, and Ghana Data Protection Act (Act 843) Disclosure Modal.
 * Accessible directly inside the app without authentication.
 */
@Composable
fun PrivacyPolicyModal(
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f)
                .padding(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.primaryContainer,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                    Column {
                        Text(
                            text = "Privacy & Child Safety",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Ghana Act 843 & COPPA Compliant",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                Spacer(modifier = Modifier.height(12.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    PrivacySection(
                        title = "1. Student Data Protection",
                        body = "StuddyHub is designed with privacy-by-default principles for learners of all ages, including young explorers (Ages 6–14). We do not collect unnecessary personal identifiers, phone numbers, or real-time GPS locations."
                    )

                    PrivacySection(
                        title = "2. No Third-Party Ads or Tracking",
                        body = "We NEVER sell student information, profile details, or quiz logs. There are NO third-party advertising SDKs, behavioral tracking trackers, or ad-targeting mechanisms in this application."
                    )

                    PrivacySection(
                        title = "3. Offline-First Data Storage",
                        body = "Study notes, flashcards, and game progress are stored locally on your device in secure SQLite storage. Cloud synchronization occurs only when authenticated to securely back up learning milestones."
                    )

                    PrivacySection(
                        title = "4. AI Safety & Moderation",
                        body = "Our AI tutors (Professor Ollie and Coach Kwame) operate with strict automated safety filters (BLOCK_LOW_AND_ABOVE) preventing generation of inappropriate, harmful, or non-educational content."
                    )

                    PrivacySection(
                        title = "5. Parental Rights & Data Erasure",
                        body = "Parents and legal guardians maintain full control. You can inspect learning history, reset on-device progress, or permanently erase all account data anytime via the Parental Gate in Settings."
                    )

                    PrivacySection(
                        title = "6. Contact Our Data Protection Officer",
                        body = "For any inquiries regarding data protection, access requests, or compliance, please reach out to us at privacy@studdyhub.app or support@studdyhub.app."
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Button(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("I Understand", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun PrivacySection(title: String, body: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = body,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 18.sp
        )
    }
}
