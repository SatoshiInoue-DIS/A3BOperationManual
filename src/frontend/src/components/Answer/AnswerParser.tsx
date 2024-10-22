import { renderToStaticMarkup } from "react-dom/server";
import { getCitationFilePath } from "../../api";

// for DocSearch
type HtmlParsedAnswer = {
    answerHtml: string;
    citations: string[];
    followupQuestions: string[];
};

export function parseAnswerToHtml(answer: string, onCitationClicked: (citationFilePath: string) => void): HtmlParsedAnswer {
    const citations: string[] = [];
    const followupQuestions: string[] = [];

    // 回答に含まれる可能性のあるフォローアップの質問を抽出する
    let parsedAnswer = answer.replace(/<<([^>>]+)>>/g, (match, content) => {
        followupQuestions.push(content);
        return ""; // 回答からフォローアップの質問を削除する
    });

    // フォローアップの質問を削除した後、回答の末尾の空白を削除します。
    parsedAnswer = parsedAnswer.trim();

    const parts = parsedAnswer.split(/\[([^\]]+)\]/g);

    const fragments: string[] = parts.map((part, index) => {
        const parts = part.split("/");
        part = parts[parts.length - 1];

        if (index % 2 === 0) {
            return part; // 偶数インデックス：通常のテキスト
        } else {
            let citationIndex: number;
            if (citations.indexOf(part) !== -1) {
                citationIndex = citations.indexOf(part) + 1;
            } else {
                citations.push(part);
                citationIndex = citations.length;
            }

            const path = getCitationFilePath(part); // 引用ファイルパスの取得

            return renderToStaticMarkup(
                <a className="supContainer" title={part} onClick={() => onCitationClicked(path)} href="#">
                    <sup>{citationIndex}</sup>
                </a>
            );
        }
    });

    return {
        answerHtml: fragments.join(""), // すべてのフラグメントを結合して最終的なHTMLを形成する
        citations,
        followupQuestions
    };
}

// for Chat
type HtmlChatParsedAnswer = {
    answerHtml: string;
};

export function parseChatAnswerToHtml(answer: string): HtmlChatParsedAnswer {
    // フォローアップの質問を削除した後、回答の末尾の空白を削除します。
    const parsedAnswer = answer.trim();

    const parts = parsedAnswer.split(/\[([^\]]+)\]/g);

    const fragments: string[] = parts.map((part, index) => {
        return part;
    });

    return {
        answerHtml: fragments.join("")
    };
}
