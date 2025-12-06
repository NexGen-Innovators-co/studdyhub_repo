// utils.ts
export function detectCodeBlocks(text: string): any[] {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const blocks: any[] = [];
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
    const lang = match[1] || '';
    const content = match[2] || '';
    blocks.push({ lang, content, index: match.index });
    }
    
    return blocks;
    }
    
    export function classNames(...classes: any[]): string {
    return classes.filter(Boolean).join(' ');
    }