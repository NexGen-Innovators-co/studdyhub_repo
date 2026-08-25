package com.example.ui.screens.notes

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.entities.NoteEntity
import com.example.ui.components.studdyPressScale
import com.example.ui.theme.tierPrimary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

import androidx.compose.foundation.Image
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.example.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesScreen(
    viewModel: NotesViewModel,
    onNavigateToNoteDetail: (String) -> Unit,
    onNavigateToQuiz: () -> Unit,
    onNavigateToFlashcards: () -> Unit,
    onBack: () -> Unit = {},
    onDiscussWithOllie: (NoteEntity) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var isGridView by remember { mutableStateOf(true) }
    var noteToDelete by remember { mutableStateOf<NoteEntity?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }

    val categories = listOf("All", "Computer Science", "Biology", "Economics", "General")

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
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
                title = { Text("Smart Study Notes", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(
                        onClick = { isGridView = !isGridView },
                        modifier = Modifier.testTag("toggle_layout_button")
                    ) {
                        Icon(
                            imageVector = if (isGridView) Icons.Default.ViewList else Icons.Default.GridView,
                            contentDescription = "Toggle Layout Mode",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(
                        onClick = { onNavigateToNoteDetail("new") },
                        modifier = Modifier.testTag("add_note_header_button")
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add Note")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onNavigateToNoteDetail("new") },
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("New Note", fontWeight = FontWeight.Bold) },
                containerColor = tierPrimary(),
                contentColor = Color.White,
                modifier = Modifier.testTag("notes_fab_new")
            )
        }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                coroutineScope.launch {
                    isRefreshing = true
                    viewModel.refreshNotes()
                    delay(600)
                    isRefreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            state = rememberPullToRefreshState()
        ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            // Search Bar
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = viewModel::onSearchQueryChanged,
                placeholder = { Text("Search notes, tags, or content...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear search")
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("notes_search_field"),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Categories & Favorites Filter Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    FilterChip(
                        selected = state.showFavoritesOnly,
                        onClick = { viewModel.toggleFavoritesFilter() },
                        label = { Text("Favorites ★") },
                        leadingIcon = {
                            Icon(
                                imageVector = if (state.showFavoritesOnly) Icons.Default.Star else Icons.Default.StarBorder,
                                contentDescription = null,
                                tint = if (state.showFavoritesOnly) Color(0xFFFFB300) else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    )
                }
                items(categories) { cat ->
                    FilterChip(
                        selected = !state.showFavoritesOnly && state.selectedCategory == cat,
                        onClick = { viewModel.onCategorySelected(cat) },
                        label = { Text(cat) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            if (state.isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            if (state.notes.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        coil.compose.SubcomposeAsyncImage(
                            model = R.drawable.img_empty_notes_alt,
                            contentDescription = "Empty Notes Art",
                            modifier = Modifier
                                .size(160.dp)
                                .clip(RoundedCornerShape(20.dp)),
                            contentScale = ContentScale.Crop,
                            loading = {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        color = tierPrimary(),
                                        modifier = Modifier.size(36.dp)
                                    )
                                }
                            },
                            error = {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(MaterialTheme.colorScheme.surfaceVariant),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.NoteAdd,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(48.dp)
                                    )
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Study Notes Yet",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Tap 'Create First Note' or pick a study template (Cornell, Lecture, Lab Report) in the editor.",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { onNavigateToNoteDetail("new") },
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Create First Note", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = if (isGridView) GridCells.Adaptive(minSize = 150.dp) else GridCells.Fixed(1),
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(state.notes, key = { it.id }) { note ->
                        NoteCard(
                            note = note,
                            isGridView = isGridView,
                            onClick = { onNavigateToNoteDetail(note.id) },
                            onTogglePin = { viewModel.togglePin(note.id) },
                            onToggleFavorite = { viewModel.toggleFavorite(note.id) },
                            onDelete = { noteToDelete = note },
                            onDiscussWithOllie = {
                                if (note.content.isBlank()) {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("This note is empty. Add content before discussing with Ollie!")
                                    }
                                } else {
                                    onDiscussWithOllie(note)
                                }
                            }
                        )
                    }
                }
            }
        }
        } // end PullToRefreshBox
    }

    // Delete confirmation — matches the confirm-first pattern used by quizzes, schedule, and chat.
    noteToDelete?.let { note ->
        AlertDialog(
            onDismissRequest = { noteToDelete = null },
            title = { Text("Delete Note?") },
            text = { Text("Are you sure you want to delete \"${note.title}\"? This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteNote(note.id)
                        noteToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { noteToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun NoteCard(
    note: NoteEntity,
    isGridView: Boolean,
    onClick: () -> Unit,
    onTogglePin: () -> Unit,
    onToggleFavorite: () -> Unit,
    onDelete: () -> Unit,
    onDiscussWithOllie: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    val cleanPreviewText = remember(note.content) {
        stripMarkdownForPreview(note.content).ifBlank { "Empty note" }
    }

    val wordCount = remember(note.content) {
        note.content.split("\\s+".toRegex()).count { it.isNotBlank() }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .studdyPressScale()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // Header: Category Pill & Favorite / Menu
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = tierPrimary().copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = note.category.ifBlank { "General" },
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = tierPrimary(),
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 10.sp
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (note.isPinned) {
                        Icon(
                            imageVector = Icons.Default.PushPin,
                            contentDescription = "Pinned Note",
                            tint = tierPrimary(),
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onToggleFavorite,
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(
                            imageVector = if (note.isFavorite) Icons.Default.Star else Icons.Default.StarBorder,
                            contentDescription = "Favorite",
                            tint = if (note.isFavorite) Color(0xFFFFB300) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Box {
                        IconButton(
                            onClick = { showMenu = true },
                            modifier = Modifier.size(26.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More options",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(if (note.isPinned) "Unpin Note" else "Pin Note") },
                                onClick = {
                                    showMenu = false
                                    onTogglePin()
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.PushPin,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Delete Note", color = MaterialTheme.colorScheme.error) },
                                onClick = {
                                    showMenu = false
                                    onDelete()
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Note Title
            Text(
                text = note.title.ifBlank { "Untitled Note" },
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Note Excerpt (Pure Plain Text)
            Text(
                text = cleanPreviewText,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
                ),
                maxLines = if (isGridView) 2 else 3,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Bottom Footer Row: Word Count
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$wordCount words",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        fontSize = 11.sp
                    )
                )
            }
        }
    }

}

fun stripMarkdownForPreview(text: String): String {
    if (text.isBlank()) return ""
    return text
        .replace(Regex("!\\[.*?\\]\\(.*?\\)"), "") // Remove markdown images
        .replace(Regex("\\[(.*?)\\]\\(.*?\\)"), "$1") // Extract text from markdown links
        .replace(Regex("https?://\\S+"), "") // Remove raw HTTP/HTTPS URLs
        .replace(Regex("```[a-zA-Z]*[\\s\\S]*?```"), "") // Remove code blocks
        .replace("```", "")
        .replace(Regex("#+\\s*"), "") // Remove headings
        .replace(Regex("\\*\\*|\\*|__|_"), "") // Remove bold / italics
        .replace(Regex("~~.*?~~"), "") // Remove strikethrough
        .replace(Regex("- \\[ [xX]? \\]\\s*"), "") // Remove checkbox task markers
        .replace(Regex("^[\\s\\*\\-\\+]{1,3}\\s+", RegexOption.MULTILINE), "") // Remove bullet markers
        .replace(Regex("^\\d+\\.\\s+", RegexOption.MULTILINE), "") // Remove list numbers
        .replace(Regex("\\$\\$|\\$"), "") // Remove math tags
        .replace(Regex(">\\s*"), "") // Remove blockquotes
        .replace(Regex("<.*?>"), "") // Remove HTML tags
        .replace(Regex("\\|"), " ") // Replace table pipe characters
        .replace(Regex("\\r?\\n"), " ") // Replace linebreaks with single space
        .replace(Regex("\\s+"), " ") // Collapse redundant whitespace
        .trim()
}
