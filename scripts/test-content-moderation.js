// Test script for content-moderation edge function
const SUPABASE_URL = 'https://kegsrvnywshxyucgjxml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZ3NydnJ5d3NoeHl1Y2dqeG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk1ODE1MzUsImV4cCI6MjAzNTE1NzUzNX0.1Q6tXnZQqVX5XDqKfqGx7ZwR0O0HqvQfDqYxB8qX9qQ';

async function testContentModeration() {
  //console.log('Testing content moderation...\n');

  // Test cases
  const testCases = [
    {
      name: 'Educational Post - Mathematics',
      content: 'Can someone explain the concept of derivatives? I\'m struggling with calculus and need help understanding how to find the derivative of x^2.',
      contentType: 'post',
      userId: 'test-user-id',
      strictness: 'medium'
    },
    {
      name: 'Educational Post - Study Tips',
      content: 'Here are my top 5 study techniques for finals: 1) Spaced repetition 2) Active recall 3) Pomodoro technique 4) Practice tests 5) Teaching others',
      contentType: 'post',
      userId: 'test-user-id',
      strictness: 'medium'
    },
    {
      name: 'Non-Educational - Spam',
      content: 'Buy now! Limited offer! Click here to get rich quick! Best deal ever!',
      contentType: 'post',
      userId: 'test-user-id',
      strictness: 'medium'
    },
    {
      name: 'Non-Educational - Off-topic',
      content: 'What\'s everyone doing this weekend? Let\'s party!',
      contentType: 'post',
      userId: 'test-user-id',
      strictness: 'medium'
    },
    {
      name: 'Borderline - Social with Study Context',
      content: 'Looking for study buddies for organic chemistry exam next week. We can meet at the library!',
      contentType: 'post',
      userId: 'test-user-id',
      strictness: 'low'
    }
  ];

  for (const testCase of testCases) {
    //console.log(`\n🧪 Test: ${testCase.name}`);
    //console.log(`📝 Content: "${testCase.content}"`);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/content-moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(testCase)
      });

      const result = await response.json();

      //console.log(`\n✅ Result:`);
      //console.log(`   Approved: ${result.approved ? '✓' : '✗'}`);
      //console.log(`   Educational: ${result.isEducational ? 'Yes' : 'No'}`);
      //console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      //console.log(`   Educational Score: ${(result.educationalValue?.score * 100).toFixed(1)}%`);
      //console.log(`   Category: ${result.category || 'N/A'}`);
      //console.log(`   Reason: ${result.reason}`);

      if (result.suggestions && result.suggestions.length > 0) {
        //console.log(`   💡 Suggestions:`);
        result.suggestions.forEach(s => console.log(`      - ${s}`));
      }

      if (result.topics && result.topics.length > 0) {
        //console.log(`   🏷️  Topics: ${result.topics.join(', ')}`);
      }

    } catch (error) {
      //console.error(`❌ Error: ${error.message}`);
    }

    //console.log('\n' + '─'.repeat(80));
  }
}

testContentModeration();
