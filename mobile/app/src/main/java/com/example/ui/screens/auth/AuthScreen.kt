package com.example.ui.screens.auth

// ── StuddyHub voice guide ─────────────────────────────────────────────────────
// Tone: friendly, direct, and practical — a smart study partner, never a
// telemarketer. DO: say what the app just did, use concrete words ("saved",
// "due for review"), and let Professor Ollie be playful in small doses.
// DON'T: shout in caps, stack emoji in functional UI, use marketer-speak
// ("fully synchronized", "superpowers"), or refer to the app as "StuddyHub AI"
// — the product name is always "StuddyHub".
// ──────────────────────────────────────────────────────────────────────────────

import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.studdyPressScale
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.IndigoPrimary
import com.example.ui.theme.VioletTertiary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    onNavigateToMain: (Boolean) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var showForgotPasswordDialog by remember { mutableStateOf(false) }
    var hasNavigated by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(false) }

    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.checkSessionExpiredNotice(context)
    }

    // Navigate to main after successful email verification or sign in (single execution safeguard)
    LaunchedEffect(uiState.isSuccess, uiState.showVerificationScreen) {
        if (uiState.isSuccess && !uiState.showVerificationScreen && !hasNavigated) {
            hasNavigated = true
            onNavigateToMain(uiState.onboardingCompleted)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .testTag("auth_screen")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Header Image Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_study_mascot),
                    contentDescription = "Auth Campus Lounge",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    MaterialTheme.colorScheme.background
                                )
                            )
                        )
                )

                // App Brand Overlay
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.img_app_icon),
                        contentDescription = "StuddyHub Logo",
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Crop
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "StuddyHub",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = "Sign in to your study workspace",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main Auth Container Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
            ) {
                // Tab Selection
                TabRow(
                    selectedTabIndex = uiState.selectedTab,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .padding(4.dp)
                ) {
                    Tab(
                        selected = uiState.selectedTab == 0,
                        onClick = { viewModel.selectTab(0) },
                        modifier = Modifier.testTag("sign_in_tab")
                    ) {
                        Text(
                            text = "Sign In",
                            modifier = Modifier.padding(vertical = 12.dp),
                            fontWeight = if (uiState.selectedTab == 0) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                    Tab(
                        selected = uiState.selectedTab == 1,
                        onClick = { viewModel.selectTab(1) },
                        modifier = Modifier.testTag("sign_up_tab")
                    ) {
                        Text(
                            text = "Create Account",
                            modifier = Modifier.padding(vertical = 12.dp),
                            fontWeight = if (uiState.selectedTab == 1) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Error Banner
                AnimatedVisibility(visible = uiState.errorMessage != null) {
                    uiState.errorMessage?.let { error ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.errorContainer
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = "Error",
                                    tint = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = error,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }

                // Info Banner (e.g. Email Confirmation Sent)
                AnimatedVisibility(visible = uiState.infoMessage != null) {
                    uiState.infoMessage?.let { info ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MarkEmailRead,
                                    contentDescription = "Info",
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = info,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }
                }

                // Sign Up Name field
                if (uiState.selectedTab == 1) {
                    OutlinedTextField(
                        value = uiState.fullNameInput,
                        onValueChange = { viewModel.onFullNameChanged(it) },
                        label = { Text("Full Name") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .testTag("fullname_input"),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true
                    )


                }

                // Email Field
                OutlinedTextField(
                    value = uiState.emailInput,
                    onValueChange = { viewModel.onEmailChanged(it) },
                    label = { Text("Email address") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .testTag("email_input"),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    )
                )

                // Password Field
                OutlinedTextField(
                    value = uiState.passwordInput,
                    onValueChange = { viewModel.onPasswordChanged(it) },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    trailingIcon = {
                        IconButton(onClick = { viewModel.togglePasswordVisibility() }) {
                            Icon(
                                imageVector = if (uiState.isPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = "Toggle Password"
                            )
                        }
                    },
                    visualTransformation = if (uiState.isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .testTag("password_input"),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    )
                )

                // Forgot Password link for Sign In
                if (uiState.selectedTab == 0) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = {
                            viewModel.openResetDialog()
                            showForgotPasswordDialog = true
                        }) {
                            Text(
                                text = "Forgot Password?",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                } else {
                    // Password strength indicator for Sign Up
                    PasswordStrengthMeter(password = uiState.passwordInput)
                    Spacer(modifier = Modifier.height(12.dp))

                    // Confirm Password field
                    OutlinedTextField(
                        value = uiState.confirmPasswordInput,
                        onValueChange = { viewModel.onConfirmPasswordChanged(it) },
                        label = { Text("Confirm Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        trailingIcon = {
                            IconButton(onClick = { viewModel.toggleConfirmPasswordVisibility() }) {
                                Icon(
                                    imageVector = if (uiState.isConfirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = "Toggle Confirm Password"
                                )
                            }
                        },
                        visualTransformation = if (uiState.isConfirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .testTag("confirm_password_input"),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Next
                        )
                    )

                    // Password mismatch indicator
                    if (uiState.confirmPasswordInput.isNotEmpty() && uiState.passwordInput != uiState.confirmPasswordInput) {
                        Text(
                            text = "Passwords do not match",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                        )
                    } else if (uiState.confirmPasswordInput.isNotEmpty() && uiState.passwordInput == uiState.confirmPasswordInput) {
                        Text(
                            text = "✓ Passwords match",
                            style = MaterialTheme.typography.labelSmall,
                            color = EmeraldAccent,
                            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                        )
                    }

                    // Date of Birth — tap to open DatePickerDialog
                    var showDatePicker by remember { mutableStateOf(false) }
                    val datePickerState = rememberDatePickerState(
                        initialSelectedDateMillis = uiState.dateOfBirthMillis
                    )
                    val dobInteractionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }

                    // Detect taps on the read-only TextField via interactionSource
                    LaunchedEffect(dobInteractionSource) {
                        dobInteractionSource.interactions.collect { interaction ->
                            if (interaction is androidx.compose.foundation.interaction.PressInteraction.Release) {
                                showDatePicker = true
                            }
                        }
                    }

                    OutlinedTextField(
                        value = uiState.dateOfBirth,
                        onValueChange = {},
                        readOnly = true,
                        interactionSource = dobInteractionSource,
                        label = { Text("Date of Birth") },
                        leadingIcon = { Icon(Icons.Default.Cake, contentDescription = null) },
                        trailingIcon = {
                            Icon(Icons.Default.CalendarMonth, contentDescription = "Pick date", tint = MaterialTheme.colorScheme.primary)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .testTag("dob_input"),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.primary
                        )
                    )

                    if (showDatePicker) {
                        DatePickerDialog(
                            onDismissRequest = { showDatePicker = false },
                            confirmButton = {
                                TextButton(onClick = {
                                    datePickerState.selectedDateMillis?.let { millis ->
                                        val cal = java.util.Calendar.getInstance().apply { timeInMillis = millis }
                                        val display = String.format(
                                            java.util.Locale.US,
                                            "%02d/%02d/%04d",
                                            cal.get(java.util.Calendar.MONTH) + 1,
                                            cal.get(java.util.Calendar.DAY_OF_MONTH),
                                            cal.get(java.util.Calendar.YEAR)
                                        )
                                        viewModel.onDateOfBirthChanged(display)
                                        viewModel.onDateOfBirthMillisChanged(millis)
                                    }
                                    showDatePicker = false
                                }) {
                                    Text("OK")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDatePicker = false }) {
                                    Text("Cancel")
                                }
                            }
                        ) {
                            DatePicker(state = datePickerState)
                        }
                    }

                    // Phone Number (optional)
                    OutlinedTextField(
                        value = uiState.phoneNumberInput,
                        onValueChange = { viewModel.onPhoneNumberChanged(it) },
                        label = { Text("Phone Number (optional)") },
                        leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .testTag("phone_input"),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                            imeAction = ImeAction.Next
                        ),
                        placeholder = { Text("+233 ...", style = MaterialTheme.typography.bodyMedium) }
                    )
                    Text(
                        text = "For study reminders and WhatsApp groups",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier.padding(start = 4.dp, bottom = 12.dp)
                    )

                    // Terms of Service consent checkbox with clickable links
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                            .testTag("tos_checkbox"),
                        verticalAlignment = Alignment.Top
                    ) {
                        Checkbox(
                            checked = uiState.agreedToTerms,
                            onCheckedChange = { viewModel.onTermsAgreed(it) },
                            modifier = Modifier.padding(top = 2.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        val primaryColor = MaterialTheme.colorScheme.primary
                        val annotatedText = buildAnnotatedString {
                            append("I agree to the ")
                            pushStringAnnotation(tag = "TOS", annotation = "https://studdyhub.vercel.app/terms")
                            withStyle(SpanStyle(color = primaryColor, fontWeight = FontWeight.SemiBold)) { append("Terms of Service") }
                            pop()
                            append(" and ")
                            pushStringAnnotation(tag = "PRIVACY", annotation = "https://studdyhub.vercel.app/privacy-policy")
                            withStyle(SpanStyle(color = primaryColor, fontWeight = FontWeight.SemiBold)) { append("Privacy Policy") }
                            pop()
                        }
                        val context = androidx.compose.ui.platform.LocalContext.current
                        Text(
                            text = annotatedText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.clickable {
                                annotatedText.getStringAnnotations("TOS", 0, annotatedText.length).firstOrNull()?.let {
                                    try {
                                        context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(it.item)))
                                    } catch (_: Exception) {}
                                }
                                annotatedText.getStringAnnotations("PRIVACY", 0, annotatedText.length).firstOrNull()?.let {
                                    try {
                                        context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(it.item)))
                                    } catch (_: Exception) {}
                                }
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Primary Submit Button — gradient CTA with press micro-interaction
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(IndigoPrimary)
                        .studdyPressScale(enabled = !uiState.isLoading)
                        .testTag("login_button")
                        .clickable(enabled = !uiState.isLoading) {
                            if (uiState.selectedTab == 0) {
                                viewModel.signIn()
                            } else {
                                viewModel.signUp()
                            }
                        }
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = if (uiState.selectedTab == 0) "Sign In to StuddyHub" else "Create Account",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Google Sign-In button (only on Sign In tab)
                if (uiState.selectedTab == 0) {
                    val activity = androidx.compose.ui.platform.LocalContext.current as? android.app.Activity
                    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
                    var isGoogleLoading by remember { mutableStateOf(false) }

                    // Activity result launcher for native Google account picker
                    val googleSignInLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
                        contract = androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
                    ) { result ->
                        android.util.Log.d("AuthScreen", "Google Sign-In result: resultCode=${result.resultCode}, hasData=${result.data != null}")
                        // Log ALL extras from the result intent for debugging
                        result.data?.extras?.let { bundle ->
                            for (key in bundle.keySet()) {
                                android.util.Log.d("AuthScreen", "  extra[$key] = ${bundle.get(key)}")
                            }
                        }
                        if (result.data != null) {
                            // Always try to process the data — handleSignInResult extracts the
                            // actual error from ApiException when resultCode is RESULT_CANCELED.
                            coroutineScope.launch {
                                com.example.data.remote.GoogleSignInNative.handleSignInResult(
                                    data = result.data,
                                    supabaseUrl = com.example.data.remote.BackendApiService.getSupabaseUrl(),
                                    onSuccess = { accessToken, refreshToken ->
                                        android.util.Log.d("AuthScreen", "Google token exchange success, calling handleGoogleSignInResult")
                                        isGoogleLoading = false
                                        viewModel.handleGoogleSignInResult(accessToken, refreshToken)
                                    },
                                    onError = { error ->
                                        android.util.Log.e("AuthScreen", "Google Sign-In error: $error")
                                        isGoogleLoading = false
                                    }
                                )
                            }
                        } else {
                            android.util.Log.w("AuthScreen", "Google Sign-In: no data returned, resultCode=${result.resultCode}")
                            isGoogleLoading = false
                        }
                    }

                    OutlinedButton(
                        onClick = {
                            if (isGoogleLoading || activity == null) return@OutlinedButton
                            isGoogleLoading = true
                            // Launch native Google account picker via activity result launcher
                            coroutineScope.launch {
                                val intent = com.example.data.remote.GoogleSignInNative.getSignInIntent(activity)
                                if (intent != null) {
                                    googleSignInLauncher.launch(intent)
                                } else {
                                    // Failed to get intent — fall back to Chrome Custom Tab
                                    android.util.Log.w("AuthScreen", "Could not get Google Sign-In intent, falling back to Custom Tab")
                                    com.example.data.remote.GoogleSignInHelper.launchSignIn(
                                        activity,
                                        com.example.data.remote.BackendApiService.getSupabaseUrl()
                                    )
                                }
                            }
                        },
                        enabled = !uiState.isLoading && !isGoogleLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                            contentColor = MaterialTheme.colorScheme.onSurface
                        ),
                        border = ButtonDefaults.outlinedButtonBorder(enabled = !uiState.isLoading && !isGoogleLoading)
                    ) {
                        if (isGoogleLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isGoogleLoading) "Signing in..." else "Continue with Google",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Your connection is encrypted with TLS.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // Forgot Password Dialog
    if (showForgotPasswordDialog) {
        val resetSucceeded = uiState.resetMessage != null
        AlertDialog(
            onDismissRequest = {
                if (!uiState.isResettingPassword) {
                    showForgotPasswordDialog = false
                    viewModel.clearResetState()
                }
            },
            title = { Text("Reset Password") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (resetSucceeded) {
                        // Success: no email field, just confirmation copy.
                        Text(
                            text = uiState.resetMessage ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = EmeraldAccent
                        )
                    } else {
                        Text(
                            text = "Enter your account email and we'll send you a link to reset your password.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        OutlinedTextField(
                            value = uiState.resetEmailInput,
                            onValueChange = { viewModel.onResetEmailChanged(it) },
                            label = { Text("Email Address") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("reset_email_input"),
                            shape = RoundedCornerShape(14.dp),
                            singleLine = true,
                            enabled = !uiState.isResettingPassword,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Send
                            ),
                            keyboardActions = KeyboardActions(
                                onSend = {
                                    if (!uiState.isResettingPassword) {
                                        viewModel.requestPasswordReset { showForgotPasswordDialog = false }
                                    }
                                }
                            )
                        )
                        uiState.resetError?.let { error ->
                            Text(
                                text = error,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            },
            confirmButton = {
                if (resetSucceeded) {
                    Button(onClick = {
                        showForgotPasswordDialog = false
                        viewModel.clearResetState()
                    }) {
                        Text("Done")
                    }
                } else {
                    Button(
                        onClick = {
                            viewModel.requestPasswordReset { showForgotPasswordDialog = false }
                        },
                        enabled = !uiState.isResettingPassword && uiState.resetEmailInput.isNotBlank()
                    ) {
                        if (uiState.isResettingPassword) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Sending...")
                        } else {
                            Text("Send Reset Link")
                        }
                    }
                }
            },
            dismissButton = {
                if (!resetSucceeded) {
                    TextButton(
                        onClick = {
                            showForgotPasswordDialog = false
                            viewModel.clearResetState()
                        },
                        enabled = !uiState.isResettingPassword
                    ) {
                        Text("Cancel")
                    }
                }            }
        )
    }

    // Open email app helper
    val emailAppContext = androidx.compose.ui.platform.LocalContext.current
    val openEmailApp: () -> Unit = {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
            intent.data = android.net.Uri.parse("mailto:${uiState.verificationEmail}")
            emailAppContext.startActivity(intent)
        } catch (_: Exception) {}
    }

    // ── Email Verification (OTP / Magic Link) Overlay ──
    if (uiState.showVerificationScreen) {
        EmailVerificationContent(
            email = uiState.verificationEmail,
            code = uiState.verificationCode,
            isVerifying = uiState.isVerifying,
            error = uiState.verificationError,
            isSuccess = uiState.verificationSuccess,
            resendCooldownSec = uiState.resendCooldownSec,
            onCodeChanged = viewModel::onVerificationCodeChanged,
            onResend = viewModel::resendConfirmationEmail,
            onBack = viewModel::dismissVerification,
            onConfirmedViaLink = { viewModel.retrySignInAfterConfirmation() },
            onOpenEmail = openEmailApp
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailVerificationContent(
    email: String,
    code: String,
    isVerifying: Boolean,
    error: String?,
    isSuccess: Boolean,
    resendCooldownSec: Int,
    onCodeChanged: (String) -> Unit,
    onResend: () -> Unit,
    onBack: () -> Unit,
    onConfirmedViaLink: () -> Unit,
    onOpenEmail: () -> Unit
) {
    val focusRequesters = remember { List(8) { FocusRequester() } }
    val codeChars = remember(code) {
        code.padEnd(8, ' ').take(8).toMutableList()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .testTag("email_verification_screen")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(40.dp))

            // Back button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back to sign up"
                    )
                }
                Text(
                    text = "Back",
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Icon
            Surface(
                modifier = Modifier.size(80.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.MarkEmailRead,
                        contentDescription = null,
                        modifier = Modifier.size(40.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "Check your email",
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.ExtraBold
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "We sent a verification code to",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = email,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Open email app button
            OutlinedButton(
                onClick = onOpenEmail,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Email App")
            }

            Spacer(modifier = Modifier.height(20.dp))

            // 8-digit code input
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(8) { index ->
                    OutlinedTextField(
                        value = if (index < code.length) code[index].toString() else "",
                        onValueChange = { newValue ->
                            val digit = newValue.lastOrNull()?.toString() ?: ""
                            val newCode = code.toMutableList()
                            if (index < newCode.size) {
                                if (digit.isNotEmpty()) {
                                    newCode[index] = digit[0]
                                    onCodeChanged(newCode.joinToString(""))
                                    // Move focus to next field
                                    if (index < 7) {
                                        focusRequesters[index + 1].requestFocus()
                                    }
                                } else {
                                    newCode[index] = ' '
                                    onCodeChanged(newCode.joinToString(""))
                                }
                            } else if (digit.isNotEmpty() && code.length < 8) {
                                onCodeChanged((code + digit[0]).take(8))
                                if (code.length < 7) {
                                    focusRequesters[(code.length + 1).coerceAtMost(7)].requestFocus()
                                }
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(focusRequesters[index])
                            .testTag("otp_digit_$index"),
                        textStyle = MaterialTheme.typography.headlineMedium.copy(
                            textAlign = TextAlign.Center,
                            fontWeight = FontWeight.Bold
                        ),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline
                        )
                    )
                }
            }

            if (error != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }

            if (isSuccess) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "✓ Email verified! Signing you in...",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = EmeraldAccent
                    ),
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (isVerifying) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Resend code
            if (resendCooldownSec > 0) {
                Text(
                    text = "Resend code in ${resendCooldownSec}s",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                TextButton(onClick = onResend) {
                    Text(
                        text = "Resend Code",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Check your inbox (and spam folder) for the code.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            Spacer(modifier = Modifier.height(12.dp))

            // Divider
            HorizontalDivider(
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 40.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // I confirmed via link — sign me in
            Button(
                onClick = onConfirmedViaLink,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = EmeraldAccent
                )
            ) {
                Text(
                    text = "I confirmed via email \u2014 Sign me in",
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            TextButton(onClick = onBack) {
                Text(
                    text = "Back to Sign In",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}


@Composable
fun PasswordStrengthMeter(password: String) {
    val strength = when {
        password.length >= 10 && password.any { it.isDigit() } && password.any { !it.isLetterOrDigit() } -> 3
        password.length >= 6 -> 2
        password.isNotEmpty() -> 1
        else -> 0
    }

    val label = when (strength) {
        3 -> "Good"
        2 -> "Fair"
        1 -> "Too weak"
        else -> "Enter a password"
    }

    val color = when (strength) {
        3 -> EmeraldAccent
        2 -> Color(0xFFF59E0B)
        1 -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.outlineVariant
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Password Security",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            repeat(3) { index ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .clip(CircleShape)
                        .background(if (index < strength) color else MaterialTheme.colorScheme.outlineVariant)
                )
            }
        }
    }
}
