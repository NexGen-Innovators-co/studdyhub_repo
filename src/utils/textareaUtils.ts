// utils/textareaUtils.ts

// Helper function to calculate cursor position in textarea
export const getTextareaCaretCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    
    const properties = [
      'font-family', 'font-size', 'font-weight', 'font-style',
      'letter-spacing', 'text-transform', 'word-spacing', 'text-indent',
      'text-decoration', 'box-sizing', 'border-width', 'padding-left',
      'padding-right', 'padding-top', 'padding-bottom', 'line-height'
    ];
    
    properties.forEach(prop => {
      div.style[prop as any] = style[prop as any];
    });
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = textarea.clientWidth + 'px';
    div.style.height = 'auto';
    div.style.overflow = 'hidden';
    
    document.body.appendChild(div);
    
    const textBeforeCaret = textarea.value.substring(0, position);
    div.textContent = textBeforeCaret;
    
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);
    
    const coordinates = {
      top: span.offsetTop,
      left: span.offsetLeft,
      height: span.offsetHeight
    };
    
    document.body.removeChild(div);
    return coordinates;
  };