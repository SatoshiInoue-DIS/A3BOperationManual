import styles from "./UserChatMessage.module.css";
import ReactMarkdown from "react-markdown";
import CodeBlock from "../CodeBlock";

interface Props {
    message: string;
}

export const UserChatMessage = ({ message }: Props) => {
    return (
        <div className={styles.container}>
            <div className={styles.message}>
                <ReactMarkdown components={{code: CodeBlock,}}>
                    {message}
                </ReactMarkdown>
            </div>
        </div>
    );
};
