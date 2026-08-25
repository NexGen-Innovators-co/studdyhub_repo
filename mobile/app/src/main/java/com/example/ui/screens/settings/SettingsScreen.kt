package com.example.ui.screens.settings

import android.content.Intent
import android.net.Uri
import android.speech.tts.TextToSpeech
import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.Avatar3DRenderer
import com.example.ui.components.ParentalGateModal
import com.example.ui.components.PrivacyPolicyModal
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.AmberWarm
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.Radius
import com.example.ui.theme.Spacing
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.tierTertiary
import kotlinx.coroutines.launch

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS SCREEN — Standalone composable for the Settings tab
// ══════════════════════════════════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settingsState: SettingsUiState,
    viewModel: SettingsViewModel,
    onNavigateToAuth: () -> Unit = {},
    onTriggerSync: () -> Unit = {},
    onOpenSyncDetails: () -> Unit = {}
) {
    val tierColors = StuddyHubThemeTokens.colors
    val coroutineScope = rememberCoroutineScope()

    // Editable fields
    var editName by remember(settingsState.profile) { mutableStateOf(settingsState.fullName) }
    var editSchool by remember(settingsState.profile) { mutableStateOf(settingsState.school) }
    var editAcademicTier by remember(settingsState.profile) { mutableStateOf(settingsState.academicTier) }
    // For Explorer mode, the specific grade ("JHS 3") lives in user_education_profiles.year_or_grade,
    // while profiles.academic_level holds the broad category ("Junior High School").
    // educationGrade is the specific grade from year_or_grade.
    val effectiveAcademicLevel = remember(settingsState.academicLevel, settingsState.educationGrade, editAcademicTier) {
        val raw = settingsState.educationGrade.ifBlank { settingsState.academicLevel }
        when {
            raw.startsWith("Basic 1", ignoreCase = true) || raw.startsWith("Basic 2", ignoreCase = true) || raw.startsWith("Basic 3", ignoreCase = true) || raw.equals("Primary 1-3", ignoreCase = true) || raw.equals("Basic 1-3", ignoreCase = true) -> "Primary 1-3"
            raw.equals("Basic 4", ignoreCase = true) || raw.equals("Primary 4", ignoreCase = true) -> "Primary 4"
            raw.equals("Basic 5", ignoreCase = true) || raw.equals("Primary 5", ignoreCase = true) -> "Primary 5"
            raw.equals("Basic 6", ignoreCase = true) || raw.equals("Primary 6", ignoreCase = true) -> "Primary 6"
            raw.equals("Basic 7", ignoreCase = true) || raw.equals("JHS 1", ignoreCase = true) -> "JHS 1"
            raw.equals("Basic 8", ignoreCase = true) || raw.equals("JHS 2", ignoreCase = true) -> "JHS 2"
            raw.equals("Basic 9", ignoreCase = true) || raw.equals("JHS 3", ignoreCase = true) -> "JHS 3"
            else -> raw
        }
    }
    var editAcademicLevel by remember(settingsState.profile) { mutableStateOf(effectiveAcademicLevel) }
    var editLearningStyle by remember(settingsState.profile) { mutableStateOf(settingsState.learningStyle) }
    var editBio by remember(settingsState.profile) { mutableStateOf(settingsState.bio) }
    var hasChanges by remember { mutableStateOf(false) }

    var showSignOutDialog by remember { mutableStateOf(false) }
    var showResetDialog by remember { mutableStateOf(false) }
    var showEraseDialog by remember { mutableStateOf(false) }
    var showPrivacyModal by remember { mutableStateOf(false) }

    // Parental Gate state for protecting sensitive adult actions
    var showParentalGate by remember { mutableStateOf(false) }
    var pendingParentalAction by remember { mutableStateOf<(() -> Unit)?>(null) }
    var parentalGateTitle by remember { mutableStateOf("Parental Verification") }
    var parentalGateDesc by remember { mutableStateOf("Please solve the math puzzle below to verify you are a parent or guardian.") }

    fun requireParentalApproval(title: String, desc: String, onApproved: () -> Unit) {
        if (editAcademicTier.equals(AcademicTier.EXPLORER.key, ignoreCase = true)) {
            parentalGateTitle = title
            parentalGateDesc = desc
            pendingParentalAction = onApproved
            showParentalGate = true
        } else {
            onApproved()
        }
    }

    // Voice & Read Aloud (TTS)
    var ttsGender by remember { mutableStateOf(com.example.data.local.TtsSettings.voiceGender) }
    var ttsRate by remember { mutableFloatStateOf(com.example.data.local.TtsSettings.speechRate) }
    var isAiNarration by remember { mutableStateOf(com.example.data.local.TtsSettings.isAiNarrationEnabled) }
    var isTestingTts by remember { mutableStateOf(false) }
    var previewTts by remember { mutableStateOf<TextToSpeech?>(null) }

    // TTS Lifecycle
    val context = LocalContext.current
    DisposableEffect(context) {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                previewTts = engine
                engine?.let { com.example.data.local.TtsSettings.applyTo(it, ttsGender, ttsRate) }
            }
        }
        onDispose {
            engine?.stop()
            engine?.shutdown()
        }
    }

    // Sign Out Dialog
    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sign Out?")
                }
            },
            text = { Text("Your local study materials are safe. You can sign back in anytime.") },
            confirmButton = {
                Button(
                    onClick = {
                        showSignOutDialog = false
                        viewModel.signOut()
                        onNavigateToAuth()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Sign Out", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Reset Dialog
    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reset Local Data?")
                }
            },
            text = { Text("This clears all data on this device and rebuilds it from your cloud workspace. Nothing is deleted from the cloud.") },
            confirmButton = {
                Button(onClick = { showResetDialog = false; viewModel.resetLocalData() }) {
                    Text("Reset & Re-sync", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Erase Dialog
    if (showEraseDialog) {
        AlertDialog(
            onDismissRequest = { showEraseDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Erase All My Data?")
                }
            },
            text = { Text("This permanently deletes ALL your data on StuddyHub. This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = { showEraseDialog = false; viewModel.eraseAllData { onNavigateToAuth() } },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Erase Everything", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showEraseDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Parental Gate Verification Dialog
    if (showParentalGate) {
        ParentalGateModal(
            actionTitle = parentalGateTitle,
            actionDescription = parentalGateDesc,
            onSuccess = {
                showParentalGate = false
                pendingParentalAction?.invoke()
                pendingParentalAction = null
            },
            onDismiss = {
                showParentalGate = false
                pendingParentalAction = null
            }
        )
    }

    // In-App Child Privacy Policy Modal
    if (showPrivacyModal) {
        PrivacyPolicyModal(
            onDismiss = { showPrivacyModal = false }
        )
    }

    // ── Main Settings Content ──
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Spacer(modifier = Modifier.height(4.dp))

        // ════════════════════════════════════════════════════════════════════
        // SAVE BUTTON — appears when user has unsaved changes
        // ════════════════════════════════════════════════════════════════════
        if (hasChanges) {
            Button(
                onClick = {
                    viewModel.saveProfile(
                        fullName = editName,
                        school = editSchool,
                        academicLevel = editAcademicLevel,
                        academicTier = editAcademicTier,
                        learningStyle = editLearningStyle,
                        bio = editBio
                    )
                    hasChanges = false
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(14.dp),
                enabled = !settingsState.isSaving,
                contentPadding = PaddingValues(vertical = 14.dp)
            ) {
                if (settingsState.isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                } else {
                    Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(text = if (settingsState.isSaving) "Saving..." else "Save Changes", fontWeight = FontWeight.Bold)
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // EXPLORER MODE — 3D Cards (kids-specific UI)
        // ════════════════════════════════════════════════════════════════════
        if (editAcademicTier.equals(AcademicTier.EXPLORER.key, ignoreCase = true)) {
            // Profile & Avatar Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("My Explorer Badge 🎭", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface))
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Avatar3DRenderer(
                            avatarIdOrEmoji = settingsState.profile?.avatarUrl,
                            size = 64.dp,
                            showAura = false,
                            isAnimated = false,
                            borderWidth = 2.dp
                        )
                        OutlinedTextField(
                            value = editName,
                            onValueChange = { editName = it; hasChanges = true },
                            label = { Text("Explorer Nickname", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            singleLine = true
                        )
                    }
                }
            }

            // Game Sounds & Voice Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Game Sounds & Voice 🔊", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Sound Effects (SFX)", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
                        var isSfxOn by remember { mutableStateOf(com.example.ui.components.TactileSoundSystem.isSoundEnabled) }
                        Switch(
                            checked = isSfxOn,
                            onCheckedChange = { enabled ->
                                isSfxOn = enabled
                                com.example.ui.components.TactileSoundSystem.setSoundPreference(context, enabled)
                            },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Color(0xFFFF7A00))
                        )
                    }
                    Text("Tutor Voice 🦉", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val kidVoices = listOf(
                            com.example.data.local.TtsSettings.GENDER_OLLIE to "🦉 Ollie",
                            com.example.data.local.TtsSettings.GENDER_FEMALE to "👩 Warm",
                            com.example.data.local.TtsSettings.GENDER_MALE to "👨 Friendly"
                        )
                        kidVoices.forEach { (genderKey, label) ->
                            val isSel = ttsGender == genderKey
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSel) Color(0xFFFF7A00) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.weight(1f).tactileClick(onClick = {
                                    ttsGender = genderKey
                                    com.example.data.local.TtsSettings.voiceGender = genderKey
                                    previewTts?.let { com.example.data.local.TtsSettings.applyTo(it, genderKey, ttsRate) }
                                })
                            ) {
                                Text(
                                    text = label, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                    color = if (isSel) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 10.dp)
                                )
                            }
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Voice Speed: %.1fx".format(ttsRate), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Slider(
                            value = ttsRate, onValueChange = { ttsRate = it },
                            onValueChangeFinished = {
                                com.example.data.local.TtsSettings.speechRate = ttsRate
                                previewTts?.let { com.example.data.local.TtsSettings.applyTo(it, ttsGender, ttsRate) }
                            },
                            valueRange = 0.6f..1.5f,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text("Natural AI Storyteller 🪄", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp)
                            Text("Turns markdown & formulas into fun spoken words", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = isAiNarration,
                            onCheckedChange = { checked -> isAiNarration = checked; com.example.data.local.TtsSettings.isAiNarrationEnabled = checked },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Color(0xFF8B5CF6))
                        )
                    }
                }
            }

            // Class, School & Curriculum Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Class, School & Curriculum Setup 🎒", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface))
                    
                    OutlinedTextField(
                        value = editSchool,
                        onValueChange = { editSchool = it; hasChanges = true },
                        label = { Text("My School", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true
                    )
                    
                    Text("Class Level", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant))
                    
                    val basicLevels = listOf("Primary 1-3", "Primary 4", "Primary 5", "Primary 6", "JHS 1", "JHS 2", "JHS 3")
                    basicLevels.chunked(4).forEach { row ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            row.forEach { lvl ->
                                val isSel = editAcademicLevel.equals(lvl, ignoreCase = true) ||
                                    (lvl == "Primary 1-3" && (editAcademicLevel.startsWith("Basic 1", true) || editAcademicLevel.startsWith("Basic 2", true) || editAcademicLevel.startsWith("Basic 3", true) || editAcademicLevel.equals("Basic 1-3", true))) ||
                                    (lvl == "Primary 4" && editAcademicLevel.equals("Basic 4", true)) ||
                                    (lvl == "Primary 5" && editAcademicLevel.equals("Basic 5", true)) ||
                                    (lvl == "Primary 6" && editAcademicLevel.equals("Basic 6", true)) ||
                                    (lvl == "JHS 1" && editAcademicLevel.equals("Basic 7", true)) ||
                                    (lvl == "JHS 2" && editAcademicLevel.equals("Basic 8", true)) ||
                                    (lvl == "JHS 3" && editAcademicLevel.equals("Basic 9", true))
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (isSel) Color(0xFFFF7A00) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    modifier = Modifier.weight(1f).tactileClick(onClick = { editAcademicLevel = lvl; hasChanges = true })
                                ) {
                                    Text(text = lvl, fontSize = if (row.size > 4) 10.sp else 11.sp, fontWeight = FontWeight.Bold,
                                        color = if (isSel) Color.White else MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(vertical = 8.dp))
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Core Subjects (Auto-assigned)", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant))
                    val coreSubjects = listOf("English", "Math", "Science", "Social Studies", "ICT")
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(coreSubjects.size) { idx ->
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                            ) {
                                Text(
                                    text = "📖 ${coreSubjects[idx]}",
                                    fontSize = 10.sp,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

            // Parent / Guardian Switch
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("🔒", fontSize = 18.sp)
                        Text("Parent / Guardian Settings", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary))
                    }
                    Text("Switching to SHS (Achiever) or University (Scholar) mode adjusts difficulty to senior exams.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(AcademicTier.ACHIEVER to "Switch to SHS ⚡", AcademicTier.SCHOLAR to "Switch to Uni 🎓").forEach { (t, label) ->
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surface,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)),
                                modifier = Modifier.weight(1f).tactileClick(onClick = {
                                    requireParentalApproval(
                                        title = "Switch Learning Mode",
                                        desc = "Ask a parent or guardian to verify before switching to ${t.displayName} mode."
                                    ) {
                                        editAcademicTier = t.key
                                        viewModel.updateAcademicTier(t.key)
                                    }
                                })
                            ) {
                                Text(text = label, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary),
                                    textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 10.dp))
                            }
                        }
                    }
                }
            }
        } else {
            // ════════════════════════════════════════════════════════════════════
            // STANDARD MODE — Learning Mode (Achiever & Scholar)
            // ════════════════════════════════════════════════════════════════════
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, tierColors.cardBorder.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(Spacing.cardPadding), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                        Icon(Icons.Default.School, contentDescription = null, tint = tierColors.primary, modifier = Modifier.size(22.dp))
                        Text("Learning Mode", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    }
                    val tierOptions = listOf(
                        AcademicTier.EXPLORER to ("Explorer (Basic School / JHS)" to "Visual puzzles, encouragement & friendly mascot"),
                        AcademicTier.ACHIEVER to ("Achiever (SHS / WASSCE)" to "WASSCE prep, high-yield summaries & speed drills"),
                        AcademicTier.SCHOLAR to ("Scholar (University / Research)" to "Deep analysis, references & rigorous mock exams")
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        tierOptions.forEach { (tierOption, descPair) ->
                            val (title, subtitle) = descPair
                            val isSelected = editAcademicTier.equals(tierOption.key, ignoreCase = true)
                            Surface(
                                shape = RoundedCornerShape(Radius.md),
                                color = if (isSelected) tierColors.pillBackground else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                border = if (isSelected) BorderStroke(1.5.dp, tierColors.primary) else BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                                modifier = Modifier.fillMaxWidth().clickable {
                                    editAcademicTier = tierOption.key; viewModel.updateAcademicTier(tierOption.key)
                                }
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.md, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(Spacing.md)
                                ) {
                                    Text(tierOption.emoji, fontSize = 24.sp)
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = title, style = MaterialTheme.typography.labelLarge.copy(
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isSelected) tierColors.primary else MaterialTheme.colorScheme.onSurface))
                                        Text(text = subtitle, style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Edit Profile Info
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, tierColors.cardBorder.copy(alpha = 0.4f))
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Edit Profile Info", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = tierPrimary())
                    OutlinedTextField(value = editName, onValueChange = { editName = it; hasChanges = true }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true)
                    OutlinedTextField(value = editSchool, onValueChange = { editSchool = it; hasChanges = true }, label = { Text("University / School") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true)
                    OutlinedTextField(value = editBio, onValueChange = { editBio = it; hasChanges = true }, label = { Text("Bio / About") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), minLines = 2, maxLines = 3)
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // VOICE & READ ALOUD (TTS) — shared by Achiever & Scholar only
        // Explorer has its own "Game Sounds & Voice" card above
        // ════════════════════════════════════════════════════════════════════
        if (!editAcademicTier.equals(AcademicTier.EXPLORER.key, ignoreCase = true)) Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, tierColors.cardBorder.copy(alpha = 0.4f))
        ) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.VolumeUp, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(22.dp))
                    Column {
                        Text("Voice & Read Aloud (TTS)", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Natural voice narration for study notes, chat & quizzes", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
                // Voice Persona
                Text("Voice Persona", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    val voiceOptions = listOf(
                        com.example.data.local.TtsSettings.GENDER_OLLIE to "🦉 Tutor Ollie",
                        com.example.data.local.TtsSettings.GENDER_FEMALE to "👩 Warm Female",
                        com.example.data.local.TtsSettings.GENDER_MALE to "👨 Deep Male",
                        com.example.data.local.TtsSettings.GENDER_DEFAULT to "📱 Device"
                    )
                    voiceOptions.forEach { (genderKey, label) ->
                        val isSel = ttsGender == genderKey
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSel) tierColors.pillBackground else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                            border = if (isSel) BorderStroke(1.5.dp, tierColors.primary) else BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                            modifier = Modifier.weight(1f).clickable {
                                ttsGender = genderKey; com.example.data.local.TtsSettings.voiceGender = genderKey
                                previewTts?.let { com.example.data.local.TtsSettings.applyTo(it, genderKey, ttsRate) }
                            }
                        ) {
                            Text(text = label, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSel) tierColors.primary else MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp), maxLines = 1)
                        }
                    }
                }
                // Speech Rate
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Speech Speed", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold))
                        Text("%.2fx".format(ttsRate), style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                    }
                    Slider(
                        value = ttsRate, onValueChange = { ttsRate = it },
                        onValueChangeFinished = {
                            com.example.data.local.TtsSettings.speechRate = ttsRate
                            previewTts?.let { com.example.data.local.TtsSettings.applyTo(it, ttsGender, ttsRate) }
                        },
                        valueRange = 0.6f..1.5f, modifier = Modifier.fillMaxWidth()
                    )
                }
                // AI Spoken Script
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierAccent(), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("AI Spoken Script Mode", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("AI rewrites markdown, formulas & tables into natural speech.", style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f))
                        }
                        Switch(checked = isAiNarration, onCheckedChange = { checked -> isAiNarration = checked; com.example.data.local.TtsSettings.isAiNarrationEnabled = checked })
                    }
                }
                // Test Voice Button
                Button(
                    onClick = {
                        if (isTestingTts) { previewTts?.stop(); isTestingTts = false }
                        else {
                            previewTts?.let { engine ->
                                isTestingTts = true
                                coroutineScope.launch {
                                    com.example.data.local.TtsSettings.speakWithAiNarration(
                                        tts = engine,
                                        rawText = "Hello! I am your AI study narrator on StuddyHub. I translate complex formulas, notes, and lectures into clear, natural speech.",
                                        utterancePrefix = "tts_preview",
                                        isKid = false,
                                        onAllDone = { isTestingTts = false }
                                    )
                                }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(imageVector = if (isTestingTts) Icons.Default.StopCircle else Icons.Default.PlayCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = if (isTestingTts) "Stop Voice Sample" else "Test Natural Voice Sample", fontWeight = FontWeight.Bold)
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // SYNC STATUS
        // ════════════════════════════════════════════════════════════════════
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Cloud, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Data Sync Status", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    }
                    TextButton(onClick = onTriggerSync) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Sync Now", fontWeight = FontWeight.Bold)
                    }
                }
                if (settingsState.pendingSyncCount > 0 || settingsState.failedSyncCount > 0) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (settingsState.pendingSyncCount > 0) {
                            Surface(shape = RoundedCornerShape(8.dp), color = tierPrimary().copy(alpha = 0.12f), modifier = Modifier.clickable { onOpenSyncDetails() }) {
                                Text("⏳ ${settingsState.pendingSyncCount} pending", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                            }
                        }
                        if (settingsState.failedSyncCount > 0) {
                            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.error.copy(alpha = 0.12f), modifier = Modifier.clickable { onOpenSyncDetails() }) {
                                Text("❌ ${settingsState.failedSyncCount} failed", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error))
                            }
                        }
                    }
                } else {
                    Text("All data is synchronized!", style = MaterialTheme.typography.bodySmall.copy(color = tierAccent()), fontWeight = FontWeight.Medium)
                }
                // Dev log (debug only - only shown for debug builds in non-explorer mode)
                if (com.example.BuildConfig.DEBUG && !editAcademicTier.equals(AcademicTier.EXPLORER.key, ignoreCase = true)) {
                    Button(onClick = onOpenSyncDetails, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(vertical = 10.dp, horizontal = 12.dp)) {
                        Icon(Icons.Default.CloudSync, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = if (settingsState.failedSyncCount > 0) "Inspect Sync Errors (${settingsState.failedSyncCount})" else "Inspect Cloud Sync", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                } else if (settingsState.failedSyncCount > 0) {
                    TextButton(onClick = onOpenSyncDetails) {
                        Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("${settingsState.failedSyncCount} sync errors — tap to retry", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // CONNECTION STATUS
        // ════════════════════════════════════════════════════════════════════
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            val isConfigured = remember { com.example.data.remote.BackendApiService.isConfigured() }
            val isOnline = com.example.ui.components.rememberIsOnline()
            val isConnected = isConfigured && isOnline
            val statusTint = when { isConnected -> tierAccent(); isConfigured -> MaterialTheme.colorScheme.error; else -> AmberWarm }

            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = when { isConnected -> Icons.Default.CloudDone; isConfigured -> Icons.Default.CloudOff; else -> Icons.Default.CloudQueue },
                        contentDescription = null, tint = statusTint, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Connection Status", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    Spacer(modifier = Modifier.weight(1f))
                    Surface(shape = RoundedCornerShape(8.dp), color = statusTint.copy(alpha = 0.12f)) {
                        Text(text = when { isConnected -> "Connected"; isConfigured -> "Offline"; else -> "Not Set Up" },
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = statusTint))
                    }
                }
                Text(text = when {
                    isConnected -> "Your workspace is connected. Your data syncs automatically."
                    isConfigured -> "You're offline. Your work is saved locally and will sync when back online."
                    else -> "Cloud sync isn't configured. Your work is saved on this device."
                }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // HELP & SUPPORT
        // ════════════════════════════════════════════════════════════════════
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Text("Help & Support", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), modifier = Modifier.padding(vertical = 10.dp), color = tierColors.primary)
                val helpCtx = LocalContext.current
                listOf(
                    Triple(Icons.Default.Help, "Help Center", "https://studdyhub.vercel.app/help"),
                    Triple(Icons.Default.Star, "Rate StuddyHub", "https://play.google.com/store/apps/details?id=com.aistudio.studdyhub.app"),
                ).forEach { (icon, title, url) ->
                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { try { helpCtx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {} }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f))
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                    }
                }
                Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { try { helpCtx.startActivity(Intent(Intent.ACTION_SENDTO).apply { data = Uri.parse("mailto:support@studdyhub.app"); putExtra(Intent.EXTRA_SUBJECT, "StuddyHub Support") }) } catch (_: Exception) {} }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Email, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Contact Support", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                        Text("support@studdyhub.app", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                }
                Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { try { helpCtx.startActivity(Intent(Intent.ACTION_SENDTO).apply { data = Uri.parse("mailto:support@studdyhub.app"); putExtra(Intent.EXTRA_SUBJECT, "Feature Request"); putExtra(Intent.EXTRA_TEXT, "I'd like to suggest: ") }) } catch (_: Exception) {} }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Lightbulb, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Suggest a Feature", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f))
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // ACCOUNT / DANGER ZONE
        // ════════════════════════════════════════════════════════════════════
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.15f))) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Account Options", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = MaterialTheme.colorScheme.error)
                }
                OutlinedButton(onClick = { showSignOutDialog = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error), border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.3f))) {
                    Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(modifier = Modifier.width(8.dp)); Text("Sign Out", fontWeight = FontWeight.Bold)
                }
                OutlinedButton(
                    onClick = {
                        requireParentalApproval(
                            title = "Reset Device Data",
                            desc = "A parent or guardian must confirm before resetting local data."
                        ) {
                            showResetDialog = true
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(modifier = Modifier.width(8.dp)); Text("Reset Local Data & Re-sync", fontWeight = FontWeight.Bold)
                }
                OutlinedButton(
                    onClick = {
                        requireParentalApproval(
                            title = "Erase Account Data",
                            desc = "A parent or guardian must confirm before permanently deleting all account data."
                        ) {
                            showEraseDialog = true
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.3f))
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(modifier = Modifier.width(8.dp)); Text("Erase All My Data", fontWeight = FontWeight.Bold)
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // ABOUT & PRIVACY
        // ════════════════════════════════════════════════════════════════════
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Text("About & Legal", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), modifier = Modifier.padding(vertical = 10.dp), color = tierColors.primary)
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("App version", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("v${com.example.BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                }
                Column(modifier = Modifier.padding(vertical = 4.dp, horizontal = 4.dp)) {
                    Text("What's New", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("• Parental gate for young explorer settings\n• In-app privacy policy & COPPA disclosures\n• Improved offline support\n• Bug fixes & performance", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
                Spacer(modifier = Modifier.height(4.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(4.dp))

                // In-App Privacy Policy trigger
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { showPrivacyModal = true }
                        .padding(vertical = 10.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = tierColors.primary, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Child Privacy & Safety", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                        Text("In-app COPPA & Ghana Act 843 summary", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                }

                val aboutCtx = LocalContext.current
                listOf(
                    Triple(Icons.Default.PrivacyTip, "Web Privacy Policy", "https://studdyhub.vercel.app/privacy-policy"),
                    Triple(Icons.Default.Description, "Terms of Service", "https://studdyhub.vercel.app/terms-of-service"),
                ).forEach { (icon, title, url) ->
                    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { try { aboutCtx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {} }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f))
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
        // Extra bottom padding so content isn't hidden behind bottom navigation bar
        Spacer(modifier = Modifier.height(80.dp))
    }
}
