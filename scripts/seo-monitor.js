// scripts/seo-monitor.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateSEOReport() {
    const report = {
        generatedAt: new Date().toISOString(),
        totalPublicPosts: 0,
        totalPublicUsers: 0,
        totalPublicGroups: 0,
        totalHashtags: 0,
        missingMetaData: [],
        topPerformingContent: [],
        recommendations: []
    };

    // Check public content counts
    const { count: postCount } = await supabase
        .from('social_posts')
        .select('*', { count: 'exact', head: true })
        .eq('privacy', 'public');

    const { count: userCount } = await supabase
        .from('social_users')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

    const { count: groupCount } = await supabase
        .from('social_groups')
        .select('*', { count: 'exact', head: true })
        .eq('privacy', 'public');

    report.totalPublicPosts = postCount;
    report.totalPublicUsers = userCount;
    report.totalPublicGroups = groupCount;

    // Check for missing metadata
    const { data: postsMissingData } = await supabase
        .from('social_posts')
        .select('id, content')
        .eq('privacy', 'public')
        .or('content.is.null,content.eq.')
        .limit(100);

    if (postsMissingData?.length > 0) {
        report.missingMetaData.push(...postsMissingData.map(p => ({
            type: 'post',
            id: p.id,
            issue: 'Empty or missing content'
        })));
    }

    // Get top performing content
    const { data: topPosts } = await supabase
        .from('social_posts')
        .select('id, content, likes_count, comments_count, views_count')
        .eq('privacy', 'public')
        .order('views_count', { ascending: false })
        .limit(10);

    report.topPerformingContent = topPosts || [];

    // Generate recommendations
    if (report.totalPublicPosts < 100) {
        report.recommendations.push('Increase public content: Encourage users to create public posts');
    }

    if (report.missingMetaData.length > 0) {
        report.recommendations.push('Fix missing metadata: ' + report.missingMetaData.length + ' items need attention');
    }

    // Save report
    fs.writeFileSync(
        `seo-report-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(report, null, 2)
    );

    ////console.log('SEO Report Generated:', report);
}

// Run weekly via cron job
generateSEOReport();