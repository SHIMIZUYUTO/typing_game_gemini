export function setupDiffView() {
    const diffButton = document.getElementById("diff-button");
    const closeDiffBtn = document.getElementById("close-diff");
    const diffContainer = document.getElementById("diff-container");

    let diffEditor = null;

    diffButton.addEventListener("click", () => {
        if (!window.placeholderEditor || !window.editor) return;

        // 差分エディタを表示
        diffContainer.style.display = "block";
        closeDiffBtn.disabled = false;

        // すでにDiffエディタが存在する場合は破棄
        if (diffEditor) {
            diffEditor.dispose();
        }

        // モデル作成
        const original = window.placeholderEditor.getValue();
        const modified = window.editor.getValue();
        const originalModel = window.monaco.editor.createModel(original, "c");
        const modifiedModel = window.monaco.editor.createModel(modified, "c");

        // Diffエディタ生成
        diffEditor = window.monaco.editor.createDiffEditor(diffContainer, {
            theme: "vs",
            fontSize: 16,
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: false }
        });

        diffEditor.setModel({
            original: originalModel,
            modified: modifiedModel
        });
    });

    closeDiffBtn.addEventListener("click", () => {
        diffContainer.style.display = "none";
        closeDiffBtn.disabled = true;
        if (diffEditor) {
            diffEditor.dispose();
            diffEditor = null;
        }
    });
}