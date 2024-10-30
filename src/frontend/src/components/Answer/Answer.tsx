import { useMemo } from "react";
import { Stack } from "@fluentui/react";

import styles from "./Answer.module.css";

import { AskResponse, getCitationFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import ReactMarkdown from 'react-markdown'
import CodeBlock from "../CodeBlock";
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string) => void;
}

export const Answer = ({
    answer,
    isSelected,
    onCitationClicked,
}: Props) => {
    // parseAnswerToHtml関数で返されるparsedAnswerがHTMLとマークダウンを含む
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, onCitationClicked), [answer]);
    // DOMPurifyを使ってHTMLをサニタイズ
    // const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item grow>
                <div className={styles.answerText}>
                    <ReactMarkdown
                        children={parsedAnswer.answerHtml} 
                        components={{ code: CodeBlock }} // マークダウンのcode部分を処理
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm]}
                        remarkRehypeOptions={{ passThrough: ['link'] }}
                    />
                </div>
            </Stack.Item>
            {!!parsedAnswer.citations.length && (
                <Stack.Item className={styles.citationFileBox}>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>引用:</span>
                        {parsedAnswer.citations.map((x, i) => {
                            const path = getCitationFilePath(x);
                            return (
                                <a key={i} className={styles.citation} title={x} onClick={() => onCitationClicked(path)}>
                                    {`${++i}. ${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
