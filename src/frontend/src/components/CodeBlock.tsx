import { CodeComponent } from "react-markdown/lib/ast-to-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nightOwl } from 'react-syntax-highlighter/dist/cjs/styles/prism';


const CodeBlock: CodeComponent = ({ inline, className, children }) => {
    if (inline) {
        return <code className={className}>{children}</code>;
    }
    const match = /language-(\w+)/.exec(className || '');
    const lang = match && match[1] ? match[1] : '';
    //ダブルアンダーバー（'__'）で言語を区切るとlang1とlang2に分割しますが、.exec()メソッドが`__`を拾えるのかは不明
    const [lang1, lang2] = lang.split('__');

  
    const { added, removed } = (() => {
        const added: number[] = [];
        const removed: number[] = [];
        let lineNumber = 0;
        const lines = String(children).split('\n');
        for (let i = 0; i < lines.length; i++) {
            lineNumber++;
            if (/^\+\s.*$/.test(lines[i])) {
            added.push(lineNumber);
            }
            if (/^\-\s.*$/.test(lines[i])) {
            removed.push(lineNumber);
            }
        }
        return { added, removed };
    })();

    //diffと入れると違いを+と-などの違いを色分けで表示してくれます（例：```js__diff【改行】〇〇【改行】```）
    const lineProps: lineTagPropsFunction = (lineNumber) => {
        let style: React.CSSProperties = {};
        if (lang2 === 'diff') {
            if (added.includes(lineNumber)) {
                style.display = 'block';
                style.backgroundColor = 'rgba(0, 0, 255, 0.4)';
            }
            if (removed.includes(lineNumber)) {
                style.display = 'block';
                style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
            }
        }
        return { style };
    };
  
    return (
        <SyntaxHighlighter
            style={nightOwl}
            language={lang1}
            children={String(children).replace(/\n$/, '')}
            wrapLines={true}
            showLineNumbers={true}
            lineProps={lineProps}
        />
    );
};

export default CodeBlock;