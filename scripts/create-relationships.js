require('dotenv').config({ path: '.env.local' });
const neo4j = require('neo4j-driver');
const { Pinecone } = require('@pinecone-database/pinecone');

const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;
const neo4jDatabase = process.env.NEO4J_DATABASE || 'neo4j';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function createRelationshipsForExistingTasks() {
  const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
  const session = driver.session({ database: neo4jDatabase });

  try {
    console.log('=== CREATING RELATIONSHIPS FOR EXISTING TASKS ===\n');

    // Get all tasks grouped by project
    const taskResult = await session.run('MATCH (t:Task) RETURN t.id as id, t.projectId as projectId, t.title as title');

    const tasksByProject = {};
    taskResult.records.forEach(record => {
      const projectId = record.get('projectId');
      if (!tasksByProject[projectId]) {
        tasksByProject[projectId] = [];
      }
      tasksByProject[projectId].push({
        id: record.get('id'),
        title: record.get('title')
      });
    });

    const index = pinecone.index('tasks');
    const SIMILARITY_THRESHOLD = 0.5; // Lowered threshold
    let totalRelationships = 0;

    for (const [projectId, tasks] of Object.entries(tasksByProject)) {
      console.log('\nProcessing project:', projectId, '(' + tasks.length + ' tasks)');
      const namespace = projectId + '-tasks-rag';
      const namespaceIndex = index.namespace(namespace);

      for (const task of tasks) {
        console.log('  Task:', task.title.substring(0, 50));

        try {
          // Search for similar tasks
          const searchResponse = await namespaceIndex.searchRecords({
            query: { topK: 5, inputs: { text: task.title } },
            fields: ['content', 'displayName']
          });

          if (searchResponse.result && searchResponse.result.hits) {
            for (const hit of searchResponse.result.hits) {
              // Skip self
              if (hit._id === task.id) continue;

              console.log('    -> ' + hit._id.substring(0, 30) + '... (score: ' + hit._score.toFixed(3) + ')');

              // Create relationship if above threshold
              if (hit._score >= SIMILARITY_THRESHOLD) {
                await session.run(
                  `MATCH (a:Task {id: $sourceId, projectId: $projectId})
                   MATCH (b:Task {id: $targetId, projectId: $projectId})
                   MERGE (a)-[r:SIMILAR_TO]->(b)
                   SET r.weight = $weight, r.createdAt = datetime()
                   RETURN r`,
                  { sourceId: task.id, targetId: hit._id, projectId, weight: hit._score }
                );
                totalRelationships++;
              }
            }
          }
        } catch (err) {
          console.log('    Error:', err.message);
        }
      }
    }

    console.log('\n=== DONE ===');
    console.log('Total relationships created:', totalRelationships);

  } finally {
    await session.close();
    await driver.close();
  }
}

createRelationshipsForExistingTasks().catch(console.error);
