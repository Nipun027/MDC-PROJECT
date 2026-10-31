import { pipeline, env } from
    "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

let extractorPromise = null;

async function getModel() {
    if (!extractorPromise) {
        extractorPromise = pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
        );
    }

    return extractorPromise;
}

function splitIntoChunks(text, wordsPerChunk = 180) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    const chunks = [];

    for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
    }

    return chunks;
}

function cosineSimilarity(a, b) {
    let dot = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }

    return Math.max(0, Math.min(1, dot));
}

window.semanticSearchDocuments = async function(query, documents) {

    const model = await getModel();

    const queryOutput = await model(query, {
        pooling: "mean",
        normalize: true
    });

    const queryVector = queryOutput.tolist()[0];

    const preparedDocuments = [];

    for (const document of documents) {

        const chunks = splitIntoChunks(document.text);

        if (chunks.length === 0) continue;

        preparedDocuments.push({
            document,
            chunks
        });
    }

    const allChunks = [];

    for (const item of preparedDocuments) {
        for (const chunk of item.chunks) {
            allChunks.push({
                document: item.document,
                text: chunk
            });
        }
    }

    const chunkScores = new Map();

    for (let i = 0; i < allChunks.length; i += 16) {

        const batch = allChunks.slice(i, i + 16);

        const output = await model(
            batch.map(item => item.text),
            {
                pooling: "mean",
                normalize: true
            }
        );

        const vectors = output.tolist();

        for (let j = 0; j < batch.length; j++) {

            const item = batch[j];

            const similarity = cosineSimilarity(
                queryVector,
                vectors[j]
            );

            const id = item.document.id;

            if (
                !chunkScores.has(id) ||
                similarity > chunkScores.get(id).score
            ) {
                chunkScores.set(id, {
                    document: item.document,
                    score: similarity
                });
            }
        }
    }

    return Array.from(chunkScores.values())
        .sort((a, b) => b.score - a.score)
        .map(item => ({
            document: item.document,
            score: Math.round(item.score * 100)
        }));
};
