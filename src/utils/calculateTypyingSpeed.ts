// utils/calculateTypingSpeed.ts
export function calculateTypingSpeed(
  text: string,
  options?: {
    minWPS?: number;
    maxWPS?: number;
    targetMinSeconds?: number;
    targetMaxSeconds?: number;
    averageWordLength?: number;
    shortMessageMinSeconds?: number; // Minimum time for short messages
  }
): number {
  const {
    minWPS = 1, // Reduced minWPS for more control
    maxWPS = 18, // Reduced maxWPS for more realistic range
    targetMinSeconds = 40,
    targetMaxSeconds = 60,
    averageWordLength = 6,
    shortMessageMinSeconds = 19 // Minimum time for very short messages (seconds)
  } = options || {};

  const trimmedText = text.trim();
  const wordCount = trimmedText.split(/\s+/).filter(word => word.length > 0).length;
  const estimatedWords = wordCount > 0 ? wordCount : Math.ceil(trimmedText.length / averageWordLength);

  const targetSeconds = (targetMinSeconds + targetMaxSeconds) / 2;
  let idealWPS = estimatedWords / targetSeconds;

  //console.log("calculateTypingSpeed - initial idealWPS:", idealWPS);

  idealWPS = Math.max(minWPS, Math.min(maxWPS, idealWPS)); // Clamp
  //console.log("calculateTypingSpeed - clamped idealWPS:", idealWPS);

  // Adjust for short messages: Force a *minimum* time
  if (estimatedWords < 125) {
    const minWPSForShort = estimatedWords / shortMessageMinSeconds;
    idealWPS = Math.min(idealWPS, minWPSForShort); // *Reduce* WPS to meet min time
    //console.log("calculateTypingSpeed - short message adjusted idealWPS:", idealWPS);
  }

  //console.log("calculateTypingSpeed - final idealWPS:", idealWPS);
  return Number(idealWPS.toFixed(2));
}