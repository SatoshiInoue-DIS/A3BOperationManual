import styles from "./UserChatMessage.module.css";
import ReactMarkdown from "react-markdown";
import CodeBlock from "../CodeBlock";
import remarkGfm from 'remark-gfm';

interface Props {
    message: string;
}

export const UserChatMessage = ({ message }: Props) => {
    return (
        <div className={styles.container}>
            <div className={styles.message}>
                <ReactMarkdown
                    children={message} 
                    components={{ code: CodeBlock }}
                    remarkPlugins={[remarkGfm]}
                    remarkRehypeOptions={{ passThrough: ['link'] }}
                />
            </div>
        </div>
    );
};
