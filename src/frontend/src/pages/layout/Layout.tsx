import React, { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate  } from "react-router-dom";
import { useMsalAuth } from "../../auth/useMsalAuth";
import { SideNav } from "../../components/SideNav";
import styles from "./Layout.module.css";
import { ChatResponse, UserConversations, AskResponse } from '../../api/models';
import { v4 as uuidv4 } from 'uuid';

const Layout = (): JSX.Element => {
    const loginUser: Promise<string | null> = useMsalAuth();
    const [userName, setUserName] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);  
    const [clearChatFunc, setClearChatFunc] = useState<() => void>(() => {});
    const [conversationContent, setConversationContent] = useState<[user: string, response: ChatResponse | AskResponse][]>([]);
    const [reupdateResult, setReupdateResult] = useState<UserConversations | null>(null);
    const [approach, setApproach] = useState<string>("chat");
    
    useEffect(() => {
        const fetchLoginUser = async () => {
            const result = await loginUser; // Promiseの結果を待つ
            if (result) {
                setUserName(result)
                const savedConversationId = localStorage.getItem('selectedConversationId');  
                if (savedConversationId) {  
                    setConversationId(savedConversationId);
                } else {
                    // 新しいIDを生成し、localStorageに保存
                    const newId = uuidv4();
                    localStorage.setItem(`selectedConversationId`, newId);
                    setConversationId(newId);
                }
            }
        }
        fetchLoginUser(); // 非同期処理を呼び出し
    }, [loginUser]);
    
    const handleConversationClick = (id: string) => {
        if (id == "clearID") {
            // IDを変更する
            const newId = uuidv4();
            localStorage.setItem('selectedConversationId', newId); // 新しいIDを保存
            setConversationId(newId); // 新しいIDで状態を更新
            setConversationContent([]);
        } else {
            setConversationId(id);
            localStorage.setItem('selectedConversationId', id);
        }
    };
    // clearChat を Chat から受け取り、state に保存する
    const handleSetClearChat = (clearFunc: () => void) => {
        setClearChatFunc(() => clearFunc);
    };
    // SideNavでconversationContentを更新するための関数  
    const updateConversationContent = (content: [user: string, response: ChatResponse | AskResponse][]) => {  
        setConversationContent(content);
    };

    const updateReupdateResult = (result: UserConversations) => {  
        setReupdateResult(result);  
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="/" className={styles.headerTitleContainer}>
                        <h3 className={styles.headerTitleLeft}>A3B_FAQ（IT基礎コース）</h3>
                    </Link>
                    <nav>
                        <ul className={styles.headerNavList}>
                            <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    ChatGPT
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/docsearch" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    研修テキスト内FAQ
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                    <h3 className={styles.headerTitleRight}>{userName}</h3>
                </div>
            </header>

            <div className={styles.mainContainer}>
                <SideNav
                    conversationId={conversationId}
                    onClick={handleConversationClick}
                    clearChat={clearChatFunc}
                    content={conversationContent}
                    updateConversationContent={updateConversationContent}
                    reupdateResult={reupdateResult}
                    loginUser={userName}
                />
                <Outlet
                    context={{
                        conversationId,
                        onClearChat: handleSetClearChat,
                        conversationContent,
                        updateReupdateResult,
                        loginUser,
                        approach,
                        handleConversationClick
                    }}
                />
            </div>
        </div>
    );
};

export default Layout;
