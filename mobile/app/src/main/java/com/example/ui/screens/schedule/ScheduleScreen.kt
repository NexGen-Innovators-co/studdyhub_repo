package com.example.ui.screens.schedule

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.entities.ScheduleItemEntity
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierAccent
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    viewModel: ScheduleViewModel,
    onNavigateToAdd: () -> Unit = {},
    onBack: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    // Dialog state
    var showFormDialog by remember { mutableStateOf(false) }
    var editingItem by remember { mutableStateOf<ScheduleItemEntity?>(null) }
    var itemToDelete by remember { mutableStateOf<ScheduleItemEntity?>(null) }

    // Completion is persisted on ScheduleItemEntity (isCompleted) and toggled through
    // the ViewModel so it survives restarts and feeds the daily streak.

    // Navigation and Calendar selection
    var activeTab by remember { mutableStateOf(0) } // 0: Calendar, 1: Upcoming, 2: Today, 3: Past, 4: All
    val tabNames = listOf("Calendar", "Upcoming", "Today", "Past", "All")

    var currentMonthCalendar by remember { mutableStateOf(Calendar.getInstance()) }
    var selectedCalendarDate by remember { mutableStateOf<Calendar>(Calendar.getInstance()) }

    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    // Date formatting helpers
    val timeFormatter = remember { SimpleDateFormat("h:mm a", Locale.getDefault()) }
    val dateFormatter = remember { SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.getDefault()) }
    val monthYearFormatter = remember { SimpleDateFormat("MMMM yyyy", Locale.getDefault()) }

    // Time calculations
    val todayStart = remember {
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
    val todayEnd = todayStart + 24 * 3600 * 1000

    // Filtered lists based on active tab
    val filteredItems = remember(state.items, activeTab, selectedCalendarDate) {
        when (activeTab) {
            0 -> { // Calendar
                state.items.filter { item ->
                    isSameDay(item.startTimeMillis, selectedCalendarDate.timeInMillis)
                }
            }
            1 -> { // Upcoming
                state.items.filter { item ->
                    item.startTimeMillis >= todayStart
                }.sortedBy { item -> item.startTimeMillis }
            }
            2 -> { // Today
                state.items.filter { item ->
                    item.startTimeMillis in todayStart..todayEnd
                }.sortedBy { item -> item.startTimeMillis }
            }
            3 -> { // Past
                state.items.filter { item ->
                    item.endTimeMillis < todayStart
                }.sortedByDescending { item -> item.startTimeMillis }
            }
            4 -> { // All
                state.items.sortedBy { item -> item.startTimeMillis }
            }
            else -> emptyList()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("back_button")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = { Text("Schedule & Timetable", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onNavigateToAdd) {
                        Icon(Icons.Default.Add, contentDescription = "Add Schedule Item")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToAdd,
                icon = { Icon(Icons.Default.AutoAwesome, contentDescription = null) },
                text = { Text("AI Assistant", fontWeight = FontWeight.Bold) },
                containerColor = tierPrimary(),
                contentColor = Color.White,
                modifier = Modifier.testTag("schedule_fab_add")
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {


            // Tabs segmented control style
            TabRow(
                selectedTabIndex = activeTab,
                modifier = Modifier.fillMaxWidth(),
                containerColor = Color.Transparent,
                contentColor = tierPrimary()
            ) {
                tabNames.forEachIndexed { index, name ->
                    Tab(
                        selected = activeTab == index,
                        onClick = { activeTab = index },
                        text = { Text(name, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Tab contents
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (activeTab == 0) {
                    // Calendar Tab Grid
                    CalendarSection(
                        currentMonthCalendar = currentMonthCalendar,
                        selectedCalendarDate = selectedCalendarDate,
                        items = state.items,
                        onMonthChange = { currentMonthCalendar = it },
                        onDateSelect = { selectedCalendarDate = it }
                    )
                    
                    Text(
                        text = "Events on ${dateFormatter.format(selectedCalendarDate.time)}",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary()),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }

                if (filteredItems.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                            Icon(
                                imageVector = Icons.Default.CalendarToday,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = when (activeTab) {
                                    0 -> "All caught up! No lectures today."
                                    1 -> "All caught up! No upcoming lectures or exams."
                                    2 -> "Your schedule is currently blank. Add items to track them."
                                    3 -> "No past schedule items recorded."
                                    else -> "Nothing scheduled."
                                },
                                style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = {
                                    editingItem = null
                                    showFormDialog = true
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                            ) {
                                Text("Add Class or Exam", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Grouping upcoming/past by day for clear visual separation
                        if (activeTab == 1 || activeTab == 3) {
                            val groupedByDay = filteredItems.groupBy { item ->
                                val cal = Calendar.getInstance().apply { timeInMillis = item.startTimeMillis }
                                cal.set(Calendar.HOUR_OF_DAY, 0)
                                cal.set(Calendar.MINUTE, 0)
                                cal.set(Calendar.SECOND, 0)
                                cal.set(Calendar.MILLISECOND, 0)
                                cal.timeInMillis
                            }
                            groupedByDay.forEach { (dayMillis, dayItems) ->
                                item {
                                    Surface(
                                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = dateFormatter.format(Date(dayMillis)),
                                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary()),
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                        )
                                    }
                                }
                                items(dayItems) { item ->
                                    EventCard(
                                        item = item,
                                        isCompleted = item.isCompleted,
                                        onToggleComplete = {
                                            viewModel.toggleCompleted(item.id, !item.isCompleted)
                                        },
                                        onEdit = {
                                            editingItem = item
                                            showFormDialog = true
                                        },
                                        onDelete = { itemToDelete = item },
                                        timeFormatter = timeFormatter,
                                        clipboardManager = clipboardManager,
                                        context = context
                                    )
                                }
                            }
                        } else {
                            items(filteredItems) { item ->
                                EventCard(
                                    item = item,
                                    isCompleted = item.isCompleted,
                                    onToggleComplete = {
                                        viewModel.toggleCompleted(item.id, !item.isCompleted)
                                    },
                                    onEdit = {
                                        editingItem = item
                                        showFormDialog = true
                                    },
                                    onDelete = { itemToDelete = item },
                                    timeFormatter = timeFormatter,
                                    clipboardManager = clipboardManager,
                                    context = context
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Confirmation Modal for Deletion
    if (itemToDelete != null) {
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            title = { Text("Delete Event?", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to permanently delete the event '${itemToDelete?.title}'?") },
            confirmButton = {
                Button(
                    onClick = {
                        itemToDelete?.let { viewModel.deleteItem(it.id) }
                        itemToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Form Modal Dialog (Add / Edit)
    if (showFormDialog) {
        ScheduleFormDialog(
            item = editingItem,
            onDismiss = { showFormDialog = false },
            onSave = { title, subject, type, start, end, location, description, color, isRec, recPat, recEnd, recDays ->
                viewModel.addScheduleItem(
                    id = editingItem?.id,
                    title = title,
                    subject = subject,
                    type = type,
                    startTimeMillis = start,
                    endTimeMillis = end,
                    location = location,
                    description = description,
                    colorHex = color,
                    isRecurring = isRec,
                    recurrencePattern = recPat,
                    recurrenceEndDate = recEnd,
                    recurrenceDaysOfWeek = recDays
                )
                showFormDialog = false
            }
        )
    }
}

@Composable
fun CalendarSection(
    currentMonthCalendar: Calendar,
    selectedCalendarDate: Calendar,
    items: List<ScheduleItemEntity>,
    onMonthChange: (Calendar) -> Unit,
    onDateSelect: (Calendar) -> Unit
) {
    val monthYearFormatter = remember { SimpleDateFormat("MMMM yyyy", Locale.getDefault()) }

    val daysOfWeek = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    val daysInGrid = remember(currentMonthCalendar) {
        val grid = mutableListOf<Calendar?>()
        val temp = currentMonthCalendar.clone() as Calendar
        temp.set(Calendar.DAY_OF_MONTH, 1)

        val firstDayOfWeek = temp.get(Calendar.DAY_OF_WEEK)
        // Add padding before
        for (i in 1 until firstDayOfWeek) {
            grid.add(null)
        }

        val totalDays = temp.getActualMaximum(Calendar.DAY_OF_MONTH)
        for (d in 1..totalDays) {
            val dCal = temp.clone() as Calendar
            dCal.set(Calendar.DAY_OF_MONTH, d)
            grid.add(dCal)
        }

        // Add padding after to make it exact multiples of 7
        while (grid.size % 7 != 0) {
            grid.add(null)
        }
        grid
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        // Month Selector Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                val next = currentMonthCalendar.clone() as Calendar
                next.add(Calendar.MONTH, -1)
                onMonthChange(next)
            }) {
                Icon(Icons.AutoMirrored.Default.ArrowBack, contentDescription = "Prev Month")
            }
            Text(
                text = monthYearFormatter.format(currentMonthCalendar.time),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
            )
            IconButton(onClick = {
                val next = currentMonthCalendar.clone() as Calendar
                next.add(Calendar.MONTH, 1)
                onMonthChange(next)
            }) {
                Icon(Icons.AutoMirrored.Default.ArrowForward, contentDescription = "Next Month")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Week Day Headers
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            daysOfWeek.forEach { day ->
                Text(
                    text = day,
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Days Grid
        val chunkedGrid = daysInGrid.chunked(7)
        chunkedGrid.forEach { row ->
            Row(modifier = Modifier.fillMaxWidth()) {
                row.forEach { dayCal ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    dayCal == null -> Color.Transparent
                                    isSameDay(dayCal.timeInMillis, selectedCalendarDate.timeInMillis) -> tierPrimary()
                                    isSameDay(dayCal.timeInMillis, System.currentTimeMillis()) -> tierPrimary().copy(alpha = 0.15f)
                                    else -> Color.Transparent
                                }
                            )
                            .clickable(enabled = dayCal != null) {
                                dayCal?.let { onDateSelect(it) }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (dayCal != null) {
                            val isSelected = isSameDay(dayCal.timeInMillis, selectedCalendarDate.timeInMillis)
                            val dayEvents = items.filter { item -> isSameDay(item.startTimeMillis, dayCal.timeInMillis) }

                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Text(
                                    text = dayCal.get(Calendar.DAY_OF_MONTH).toString(),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = when {
                                            isSelected -> Color.White
                                            else -> MaterialTheme.colorScheme.onSurface
                                        }
                                    )
                                )
                                if (dayEvents.isNotEmpty()) {
                                    Row(
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(top = 2.dp)
                                    ) {
                                        dayEvents.take(3).forEach { ev ->
                                            val fallbackDotColor = tierPrimary()
                                            val dotColor = remember(ev.colorHex) {
                                                try { Color(android.graphics.Color.parseColor(ev.colorHex)) } catch (e: Exception) { fallbackDotColor }
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .size(4.dp)
                                                    .padding(horizontal = 0.5.dp)
                                                    .clip(CircleShape)
                                                    .background(if (isSelected) Color.White else dotColor)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EventCard(
    item: ScheduleItemEntity,
    isCompleted: Boolean,
    onToggleComplete: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    timeFormatter: SimpleDateFormat,
    clipboardManager: androidx.compose.ui.platform.ClipboardManager,
    context: android.content.Context
) {
    val fallbackEventColor = tierPrimary()
    val eventColor = remember(item.colorHex) {
        try { Color(android.graphics.Color.parseColor(item.colorHex)) } catch (e: Exception) { fallbackEventColor }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(
                1.dp,
                if (isCompleted) tierAccent().copy(alpha = 0.5f) else Color.Transparent,
                RoundedCornerShape(16.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isCompleted) tierAccent().copy(alpha = 0.04f) else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
        ) {
            // Accent left strip
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(6.dp)
                    .background(if (isCompleted) tierAccent() else eventColor)
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(16.dp)
            ) {
                // Topic Badging
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = eventColor.copy(alpha = 0.12f),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Text(
                                text = item.subject,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = eventColor
                                ),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = when (item.type.lowercase()) {
                                "exam" -> Color.Red.copy(alpha = 0.1f)
                                "lecture" -> Color.Blue.copy(alpha = 0.1f)
                                "office_hours" -> Color(0xFFEAB308).copy(alpha = 0.1f)
                                "study_session" -> Color.Green.copy(alpha = 0.1f)
                                "assignment" -> Color(0xFFF97316).copy(alpha = 0.1f)
                                else -> MaterialTheme.colorScheme.surfaceVariant
                            }
                        ) {
                            Text(
                                text = item.type.uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = when (item.type.lowercase()) {
                                        "exam" -> Color.Red
                                        "lecture" -> Color.Blue
                                        "office_hours" -> Color(0xFFCA8A04)
                                        "study_session" -> Color(0xFF15803D)
                                        "assignment" -> Color(0xFFEA580C)
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    }
                                ),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }

                    // Complete Checkbox
                    IconButton(onClick = onToggleComplete, modifier = Modifier.size(24.dp)) {
                        Icon(
                            imageVector = if (isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                            contentDescription = "Toggle Complete State",
                            tint = if (isCompleted) tierAccent() else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Title
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        textDecoration = if (isCompleted) TextDecoration.LineThrough else TextDecoration.None
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (item.description.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.description,
                        style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Date Time details
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.AccessTime,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${timeFormatter.format(Date(item.startTimeMillis))} - ${timeFormatter.format(Date(item.endTimeMillis))}",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium)
                    )
                }

                // Location Details (tap to copy)
                if (item.location.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                clipboardManager.setText(AnnotatedString(item.location))
                                Toast
                                    .makeText(context, "Location copied to clipboard", Toast.LENGTH_SHORT)
                                    .show()
                            },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Place,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = tierPrimary()
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = item.location,
                            style = MaterialTheme.typography.bodySmall.copy(color = tierPrimary(), fontWeight = FontWeight.SemiBold),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Recurrence Badge
                if (item.isRecurring) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Autorenew,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = tierAccent()
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        val recDaysText = if (item.recurrenceDaysOfWeek.isNotBlank()) " on ${item.recurrenceDaysOfWeek}" else ""
                        Text(
                            text = "${item.recurrencePattern.replaceFirstChar { it.uppercase() }}$recDaysText",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierAccent())
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Action Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = onEdit,
                        colors = ButtonDefaults.textButtonColors(contentColor = tierPrimary())
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Edit", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(
                        onClick = onDelete,
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Delete", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleFormDialog(
    item: ScheduleItemEntity?,
    onDismiss: () -> Unit,
    onSave: (
        title: String,
        subject: String,
        type: String,
        startTimeMillis: Long,
        endTimeMillis: Long,
        location: String,
        description: String,
        colorHex: String,
        isRecurring: Boolean,
        recurrencePattern: String,
        recurrenceEndDate: Long?,
        recurrenceDaysOfWeek: String
    ) -> Unit
) {
    var title by remember { mutableStateOf(item?.title ?: "") }
    var subject by remember { mutableStateOf(item?.subject ?: "") }
    var type by remember { mutableStateOf(item?.type ?: "lecture") }
    var location by remember { mutableStateOf(item?.location ?: "") }
    var description by remember { mutableStateOf(item?.description ?: "") }

    var selectedColorPreset by remember { mutableStateOf(item?.colorHex ?: "#3B82F6") }
    val colorPresets = listOf("#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6")
    val colorNames = listOf("Indigo", "Green", "Red", "Orange", "Violet")

    var isRecurring by remember { mutableStateOf(item?.isRecurring ?: false) }
    var recurrencePattern by remember { mutableStateOf(item?.recurrencePattern ?: "weekly") }

    val daysOptions = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    val selectedDays = remember {
        mutableStateListOf<String>().apply {
            if (item != null && item.recurrenceDaysOfWeek.isNotBlank()) {
                addAll(item.recurrenceDaysOfWeek.split(","))
            }
        }
    }

    // Native time picker + duration chips instead of error-prone free-text entry.
    var showStartTimePicker by remember { mutableStateOf(false) }
    var startHourOfDay by remember { mutableStateOf(10) }
    var startMinute by remember { mutableStateOf(0) }
    var durationMinutes by remember { mutableIntStateOf(60) }

    var validationError by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 560.dp)
                .fillMaxHeight(0.9f)
                .testTag("schedule_form_dialog"),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (item != null) "Edit Schedule Item" else "New Schedule Item",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = tierPrimary())
                )

                validationError?.let { err ->
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = err,
                            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onErrorContainer, fontWeight = FontWeight.Bold),
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title *") },
                    placeholder = { Text("CS 101 Lecture") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject / Class *") },
                    placeholder = { Text("CS 101") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Type selector
                val types = listOf("lecture", "exam", "study_session", "office_hours", "homework")
                Column {
                    Text("Type", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        types.take(3).forEach { t ->
                            FilterChip(
                                selected = type == t,
                                onClick = { type = t },
                                label = { Text(t.replace("_", " ").uppercase()) }
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        types.drop(3).forEach { t ->
                            FilterChip(
                                selected = type == t,
                                onClick = { type = t },
                                label = { Text(t.replace("_", " ").uppercase()) }
                            )
                        }
                    }
                }

                // Start time — opens a native Material time picker.
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Start Time", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    OutlinedTextField(
                        value = formatTimeOfDay(startHourOfDay, startMinute),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Start time") },
                        trailingIcon = { Icon(Icons.Default.Schedule, contentDescription = null) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showStartTimePicker = true },
                        singleLine = true
                    )

                    Text("Duration", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(15, 30, 45, 60, 90, 120).forEach { mins ->
                            FilterChip(
                                selected = durationMinutes == mins,
                                onClick = { durationMinutes = mins },
                                label = { Text(if (mins < 60) "${mins}m" else "${mins / 60}h") },
                                shape = RoundedCornerShape(10.dp)
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Location") },
                    placeholder = { Text("Gates Room 104 or Zoom") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    placeholder = { Text("Remember reading assignment page 24-50") },
                    modifier = Modifier.fillMaxWidth()
                )

                // Color Presets Selector
                Column {
                    Text("Color Label", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        colorPresets.forEachIndexed { idx, colorStr ->
                            val parsedCol = remember(colorStr) { Color(android.graphics.Color.parseColor(colorStr)) }
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(parsedCol)
                                    .border(
                                        3.dp,
                                        if (selectedColorPreset == colorStr) MaterialTheme.colorScheme.onSurface else Color.Transparent,
                                        CircleShape
                                    )
                                    .clickable { selectedColorPreset = colorStr }
                            )
                        }
                    }
                }

                // Recurrence
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isRecurring, onCheckedChange = { isRecurring = it })
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Is Recurring Event", fontWeight = FontWeight.Bold)
                }

                if (isRecurring) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Pattern", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("daily", "weekly", "monthly").forEach { pat ->
                                FilterChip(
                                    selected = recurrencePattern == pat,
                                    onClick = { recurrencePattern = pat },
                                    label = { Text(pat.uppercase()) }
                                )
                            }
                        }

                        if (recurrencePattern == "weekly") {
                            Text("Days of Week", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                daysOptions.forEach { d ->
                                    val isSelected = selectedDays.contains(d)
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(CircleShape)
                                            .background(if (isSelected) tierPrimary() else MaterialTheme.colorScheme.surfaceVariant)
                                            .clickable {
                                                if (isSelected) selectedDays.remove(d) else selectedDays.add(d)
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = d.take(1),
                                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Button(
                        onClick = {
                            if (title.isBlank()) {
                                validationError = "Title is required"
                                return@Button
                            }
                            if (subject.isBlank()) {
                                validationError = "Subject is required"
                                return@Button
                            }

                            val startCal = Calendar.getInstance().apply {
                                set(Calendar.HOUR_OF_DAY, startHourOfDay)
                                set(Calendar.MINUTE, startMinute)
                                set(Calendar.SECOND, 0)
                                set(Calendar.MILLISECOND, 0)
                            }
                            val endCal = (startCal.clone() as Calendar).apply {
                                add(Calendar.MINUTE, durationMinutes)
                            }

                            onSave(
                                title,
                                subject,
                                type,
                                startCal.timeInMillis,
                                endCal.timeInMillis,
                                location,
                                description,
                                selectedColorPreset,
                                isRecurring,
                                recurrencePattern,
                                null, // recurrenceEndDate
                                selectedDays.joinToString(",")
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                    ) {
                        Text("Save", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // Native time picker dialog for the start time field.
    if (showStartTimePicker) {
        val timeState = rememberTimePickerState(
            initialHour = startHourOfDay,
            initialMinute = startMinute,
            is24Hour = false
        )
        AlertDialog(
            onDismissRequest = { showStartTimePicker = false },
            title = { Text("Select Start Time", fontWeight = FontWeight.Bold) },
            text = { TimePicker(state = timeState) },
            confirmButton = {
                Button(
                    onClick = {
                        startHourOfDay = timeState.hour
                        startMinute = timeState.minute
                        showStartTimePicker = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showStartTimePicker = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

private fun formatTimeOfDay(hourOfDay: Int, minute: Int): String {
    val displayHour = hourOfDay % 12
    val h = if (displayHour == 0) 12 else displayHour
    val ampm = if (hourOfDay < 12) "AM" else "PM"
    return String.format(java.util.Locale.US, "%d:%02d %s", h, minute, ampm)
}

private fun isSameDay(t1: Long, t2: Long): Boolean {
    val cal1 = Calendar.getInstance().apply { timeInMillis = t1 }
    val cal2 = Calendar.getInstance().apply { timeInMillis = t2 }
    return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
            cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
}
