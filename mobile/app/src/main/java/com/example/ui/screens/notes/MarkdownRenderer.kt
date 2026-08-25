package com.example.ui.screens.notes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Functions
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary

@Composable
fun MarkdownLaTeXRenderer(
    text: String,
    modifier: Modifier = Modifier,
    onTaskCheckedChange: ((taskIndex: Int, isChecked: Boolean) -> Unit)? = null
) {
    SelectionContainer {
        com.example.ui.screens.aichat.components.ChatMarkdownRenderer(
            text = text,
            modifier = modifier,
            streaming = false,
            onTaskCheckedChange = onTaskCheckedChange
        )
    }
}

// Blocks Definitions
sealed class Block {
    data class Header(val level: Int, val text: String) : Block()
    data class ListBlock(val ordered: Boolean, val items: List<String>) : Block()
    data class TaskItem(val checked: Boolean, val text: String) : Block()
    data class Blockquote(val text: String) : Block()
    data class CodeBlock(val language: String, val code: String) : Block()
    data class MermaidDiagram(val code: String, val type: String) : Block()
    data class LaTeXBlock(val math: String) : Block()
    data class Paragraph(val text: String) : Block()
}

// Parser to split text into distinct Blocks
fun parseMarkdownBlocks(text: String): List<Block> {
    val lines = text.split("\n")
    val blocks = mutableListOf<Block>()
    var i = 0

    while (i < lines.size) {
        val line = lines[i].trim()

        if (line.isEmpty()) {
            i++
            continue
        }

        // 1. Code Block & Mermaid Diagram
        if (line.startsWith("```")) {
            val lang = line.removePrefix("```").trim()
            val codeLines = mutableListOf<String>()
            i++
            while (i < lines.size && !lines[i].trim().startsWith("```")) {
                codeLines.add(lines[i])
                i++
            }
            if (i < lines.size) i++ // skip ending ```
            val fullCode = codeLines.joinToString("\n")
            if (lang.equals("mermaid", ignoreCase = true) || lang.equals("diagram", ignoreCase = true) ||
                fullCode.contains("graph ") || fullCode.contains("flowchart ") || fullCode.contains("sequenceDiagram") || fullCode.contains("mindmap")) {
                val diagramType = when {
                    fullCode.contains("mindmap") -> "Mindmap"
                    fullCode.contains("sequenceDiagram") -> "Sequence Diagram"
                    else -> "Flowchart"
                }
                blocks.add(Block.MermaidDiagram(fullCode, diagramType))
            } else {
                blocks.add(Block.CodeBlock(lang, fullCode))
            }
            continue
        }

        // 2. Task Checkbox Item (- [ ] or - [x])
        if (line.startsWith("- [ ]") || line.startsWith("- [x]") || line.startsWith("- [X]")) {
            val isChecked = line.startsWith("- [x]") || line.startsWith("- [X]")
            val taskText = line.drop(5).trim()
            blocks.add(Block.TaskItem(isChecked, taskText))
            i++
            continue
        }

        // 3. LaTeX Block Math (wrapped in $$)
        if (line.startsWith("$$")) {
            val mathLines = mutableListOf<String>()
            val initialMath = line.removePrefix("$$").trim()
            if (initialMath.isNotEmpty()) {
                if (initialMath.endsWith("$$")) {
                    blocks.add(Block.LaTeXBlock(initialMath.removeSuffix("$$").trim()))
                    i++
                    continue
                } else {
                    mathLines.add(initialMath)
                }
            }
            i++
            while (i < lines.size && !lines[i].trim().startsWith("$$")) {
                mathLines.add(lines[i])
                i++
            }
            if (i < lines.size) {
                val endLine = lines[i].trim().removeSuffix("$$").trim()
                if (endLine.isNotEmpty()) mathLines.add(endLine)
                i++
            }
            blocks.add(Block.LaTeXBlock(mathLines.joinToString("\n")))
            continue
        }

        // 3. Headers
        if (line.startsWith("#")) {
            val level = line.takeWhile { it == '#' }.length
            if (level in 1..6) {
                val headerText = line.drop(level).trim()
                blocks.add(Block.Header(level, headerText))
                i++
                continue
            }
        }

        // 4. Blockquotes
        if (line.startsWith(">")) {
            val quoteLines = mutableListOf<String>()
            while (i < lines.size && lines[i].trim().startsWith(">")) {
                quoteLines.add(lines[i].trim().removePrefix(">").trim())
                i++
            }
            blocks.add(Block.Blockquote(quoteLines.joinToString("\n")))
            continue
        }

        // 5. Lists (unordered)
        if (line.startsWith("- ") || line.startsWith("* ")) {
            val listItems = mutableListOf<String>()
            while (i < lines.size && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
                listItems.add(lines[i].trim().drop(2).trim())
                i++
            }
            blocks.add(Block.ListBlock(ordered = false, items = listItems))
            continue
        }

        // 6. Lists (ordered)
        if (line.firstOrNull()?.isDigit() == true && line.contains(". ")) {
            val listItems = mutableListOf<String>()
            while (i < lines.size && lines[i].trim().firstOrNull()?.isDigit() == true && lines[i].trim().contains(". ")) {
                val dropPrefix = lines[i].trim().substringAfter(". ").trim()
                listItems.add(dropPrefix)
                i++
            }
            blocks.add(Block.ListBlock(ordered = true, items = listItems))
            continue
        }

        // 7. General Paragraph
        blocks.add(Block.Paragraph(line))
        i++
    }

    return blocks
}

// Inline formatting (bold, italic, inline code, inline latex)
// Colors are parameters because this helper runs outside composition; composable
// callers pass the tier colors in.
fun parseInlineFormatting(
    text: String,
    mathColor: Color = Color(0xFF8B5CF6),
    codeColor: Color = Color(0xFF4F46E5)
): AnnotatedString {
    return buildAnnotatedString {
        var idx = 0
        while (idx < text.length) {
            val remaining = text.substring(idx)

            // 1. Inline LaTeX Math: $ ... $
            if (remaining.startsWith("$") && !remaining.startsWith("$$")) {
                val endIdx = remaining.indexOf("$", 1)
                if (endIdx != -1) {
                    val math = remaining.substring(1, endIdx)
                    withStyle(
                        SpanStyle(
                            fontStyle = FontStyle.Italic,
                            fontFamily = FontFamily.Serif,
                            color = mathColor,
                            background = mathColor.copy(alpha = 0.08f),
                            fontWeight = FontWeight.Medium
                        )
                    ) {
                        append(" $math ")
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            // 2. Bold: ** ... **
            if (remaining.startsWith("**")) {
                val endIdx = remaining.indexOf("**", 2)
                if (endIdx != -1) {
                    val boldText = remaining.substring(2, endIdx)
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(boldText)
                    }
                    idx += endIdx + 2
                    continue
                }
            }

            // 3. Italic: * ... *
            if (remaining.startsWith("*")) {
                val endIdx = remaining.indexOf("*", 1)
                if (endIdx != -1) {
                    val italicText = remaining.substring(1, endIdx)
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(italicText)
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            // 4. Inline Code: ` ... `
            if (remaining.startsWith("`")) {
                val endIdx = remaining.indexOf("`", 1)
                if (endIdx != -1) {
                    val codeText = remaining.substring(1, endIdx)
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color.LightGray.copy(alpha = 0.3f),
                            color = codeColor,
                            fontSize = 13.sp
                        )
                    ) {
                        append(codeText)
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            // Fallback plain character
            append(remaining[0].toString())
            idx++
        }
    }
}

// --- Composable Subcomponents ---

@Composable
fun HeaderBlock(header: Block.Header) {
    val style = when (header.level) {
        1 -> MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = tierPrimary(), fontSize = 22.sp)
        2 -> MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary(), fontSize = 18.sp)
        else -> MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold, color = tierAccent(), fontSize = 15.sp)
    }

    Column(modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)) {
        Text(
            text = header.text,
            style = style
        )
        Spacer(modifier = Modifier.height(2.dp))
        if (header.level == 1) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.2f)
                    .height(3.dp)
                    .background(tierPrimary(), RoundedCornerShape(1.dp))
            )
        }
    }
}

@Composable
fun ListBlock(list: Block.ListBlock) {
    Column(
        modifier = Modifier.padding(start = 8.dp, top = 2.dp, bottom = 2.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        list.items.forEachIndexed { idx, item ->
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = if (list.ordered) "${idx + 1}. " else "• ",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = tierPrimary()
                    ),
                    modifier = Modifier.width(20.dp)
                )
                Text(
                    text = parseInlineFormatting(item),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
fun BlockquoteBlock(quote: Block.Blockquote) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Gray.copy(alpha = 0.05f))
            .border(1.dp, Color.Gray.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .padding(vertical = 10.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = Icons.Default.FormatQuote,
            contentDescription = null,
            tint = tierPrimary(),
            modifier = Modifier
                .size(20.dp)
                .padding(end = 4.dp)
        )
        Text(
            text = parseInlineFormatting(quote.text),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            ),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
fun CodeBlockElement(codeBlock: Block.CodeBlock) {
    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Code,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = codeBlock.language.ifBlank { "code" }.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .background(Color.Black.copy(alpha = 0.05f), RoundedCornerShape(6.dp))
                    .padding(8.dp)
            ) {
                Text(
                    text = codeBlock.code,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun LaTeXMathBlock(latex: Block.LaTeXBlock) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = tierTertiary().copy(alpha = 0.06f)),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, tierTertiary().copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Functions,
                contentDescription = "LaTeX Formula",
                tint = tierTertiary(),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = latex.math,
                    fontFamily = FontFamily.Serif,
                    fontSize = 16.sp,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                    color = tierTertiary()
                )
            }
        }
    }
}

@Composable
fun ParagraphBlock(para: Block.Paragraph) {
    Text(
        text = parseInlineFormatting(para.text),
        style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 22.sp),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
fun TaskItemBlock(
    item: Block.TaskItem,
    onCheckedChange: (Boolean) -> Unit
) {
    var checkedState by remember { mutableStateOf(item.checked) }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                checkedState = !checkedState
                onCheckedChange(checkedState)
            }
            .padding(vertical = 2.dp)
    ) {
        Checkbox(
            checked = checkedState,
            onCheckedChange = {
                checkedState = it
                onCheckedChange(it)
            }
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = parseInlineFormatting(item.text),
            style = MaterialTheme.typography.bodyMedium.copy(
                textDecoration = if (checkedState) TextDecoration.LineThrough else TextDecoration.None,
                color = if (checkedState) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f) else MaterialTheme.colorScheme.onSurface
            )
        )
    }
}

@Composable
fun MermaidDiagramBlock(diagram: Block.MermaidDiagram) {
    var showCode by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, tierPrimary().copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .padding(vertical = 6.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Hub,
                        contentDescription = "Diagram",
                        tint = tierPrimary(),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Visual Diagram (${diagram.type})",
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                    )
                }

                TextButton(onClick = { showCode = !showCode }) {
                    Text(if (showCode) "View Visual" else "View Code", fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (showCode) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Text(
                        text = diagram.code,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
            } else {
                val nodes = parseDiagramNodes(diagram.code)
                VisualDiagramGraph(nodes = nodes, diagramType = diagram.type)
            }
        }
    }
}

data class DiagramNode(
    val id: String,
    val label: String,
    val targetId: String? = null,
    val stepIndex: Int = 1
)

fun parseDiagramNodes(code: String): List<DiagramNode> {
    val lines = code.split("\n")
    val nodes = mutableListOf<DiagramNode>()
    var step = 1

    lines.forEach { line ->
        val trimmed = line.trim()
        if (trimmed.isBlank() || trimmed.startsWith("graph") || trimmed.startsWith("flowchart") || trimmed.startsWith("sequenceDiagram") || trimmed.startsWith("mindmap") || trimmed.startsWith("subgraph")) {
            return@forEach
        }

        if (trimmed.contains("-->") || trimmed.contains("->")) {
            val parts = trimmed.split(Regex("-->|->"))
            if (parts.size >= 2) {
                val source = parts[0].trim().replace("[", " ").replace("]", "").replace("{", "").replace("}", "")
                val target = parts[1].trim().replace("[", " ").replace("]", "").replace("{", "").replace("}", "")
                if (nodes.none { it.label == source }) {
                    nodes.add(DiagramNode(id = "step_$step", label = source, targetId = target, stepIndex = step))
                    step++
                }
                if (nodes.none { it.label == target }) {
                    nodes.add(DiagramNode(id = "step_$step", label = target, targetId = null, stepIndex = step))
                    step++
                }
            }
        } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            val label = trimmed.drop(1).trim()
            if (label.isNotBlank()) {
                nodes.add(DiagramNode(id = "step_$step", label = label, stepIndex = step))
                step++
            }
        } else if (trimmed.contains(":") && !trimmed.startsWith("%%")) {
            val parts = trimmed.split(":")
            val label = parts.last().trim()
            if (label.isNotBlank()) {
                nodes.add(DiagramNode(id = "step_$step", label = label, stepIndex = step))
                step++
            }
        }
    }

    if (nodes.isEmpty()) {
        lines.filter { it.isNotBlank() && !it.startsWith("```") && !it.startsWith("graph") }.take(5).forEach { l ->
            nodes.add(DiagramNode(id = "step_$step", label = l.trim(), stepIndex = step))
            step++
        }
    }

    return nodes
}

@Composable
fun VisualDiagramGraph(nodes: List<DiagramNode>, diagramType: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        nodes.forEachIndexed { idx, node ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = when (idx % 3) {
                        0 -> tierPrimary().copy(alpha = 0.12f)
                        1 -> tierAccent().copy(alpha = 0.12f)
                        else -> tierTertiary().copy(alpha = 0.12f)
                    }
                ),
                modifier = Modifier
                    .fillMaxWidth(0.95f)
                    .border(
                        1.dp,
                        when (idx % 3) {
                            0 -> tierPrimary().copy(alpha = 0.4f)
                            1 -> tierAccent().copy(alpha = 0.4f)
                            else -> tierTertiary().copy(alpha = 0.4f)
                        },
                        RoundedCornerShape(12.dp)
                    )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(
                                when (idx % 3) {
                                    0 -> tierPrimary()
                                    1 -> tierAccent()
                                    else -> tierTertiary()
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${node.stepIndex}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = node.label,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (idx < nodes.size - 1) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowDownward,
                        contentDescription = "Flow direction",
                        tint = tierPrimary().copy(alpha = 0.6f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
