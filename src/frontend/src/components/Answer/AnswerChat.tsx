import { useMemo } from "react";
import { Stack } from "@fluentui/react";

import styles from "./Answer.module.css";

import { ChatResponse } from "../../api";
import { parseChatAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";

import ReactMarkdown from 'react-markdown'
import CodeBlock from "../CodeBlock";
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface Props {
    answer: ChatResponse;
    isSelected?: boolean;
}

export const AnswerChat = ({ answer, isSelected }: Props) => {
    const parsedAnswer = useMemo(() => parseChatAnswerToHtml(answer.answer), [answer]);

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item grow>
                <div className={styles.answerText}>
                    <ReactMarkdown 
                        children={ parsedAnswer.answerHtml }
                        components={{ code: CodeBlock }}
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm]}
                        remarkRehypeOptions={{ passThrough: ['link'] }}/>
                </div>
            </Stack.Item>
        </Stack>
    );
};
