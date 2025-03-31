import React, { MouseEvent, useState, useEffect, useRef } from 'react';
import styles from './SideNav.module.css';
import { UserConversations, Conversation, ChatResponse, AskResponse } from '../../api/models';
import { getConversationsHistoryApi, deleteConersationApi } from "../../api";
import { Delete24Regular } from "@fluentui/react-icons";
import { Text } from "@fluentui/react";
import { useNavigate } from 'react-router-dom';

interface Props {
    conversationId: string | null;
    onClick: (id: string) => void;
    clearChat: () => void;
    // content: [user: string, response: ChatResponse | AskResponse][] | undefined;
    // updateConversationContent: (content: [user: string, response: ChatResponse | AskResponse][]) => void;
    reupdateResult: UserConversations | null;
    loginUser: string | null;
    UserRole: string;
}

export const SideNav = ({ conversationId, onClick, clearChat,
    //  content, updateConversationContent, 
     reupdateResult, loginUser, UserRole }: Props) => {
    // 表示/非表示を切り替える状況変数
    const [showSidebar, setShowSidebar] = useState<boolean>(true)
    const [conversationsData, setConversationsData] = useState<UserConversations>();
    const [showMenu, setShowMenu] = useState<boolean>(false);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const menuContainerRef = useRef<HTMLDivElement | null>(null);
    const yourComponentRef = useRef<HTMLDivElement | null>(null);
    const prevScrollTop = useRef<number>(0);
    const [isOpenDeleteModal, setIsOpenDeleteModal] = useState(false);
    const [selectConversationTitle, setCelectConversationTitle] = useState<string | null>(null);

    useEffect(() => {
        if(loginUser) {
            makeApiRequest(loginUser)
        }
    }, [loginUser]);

    useEffect(() => {
        if (reupdateResult) {
            setConversationsData(reupdateResult);
        }
    }, [reupdateResult]);

    // メニューが画面外に出ないように位置を調整
    useEffect(() => {
        if (menuContainerRef.current) {
            const menuRect = menuContainerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // メニューが画面の下にはみ出す場合
            if (menuRect.bottom > windowHeight) {
                setMenuPosition((prevPosition) => ({
                    ...prevPosition,
                    top: prevPosition.top - (menuRect.bottom - windowHeight), // はみ出し分を引いて位置を調整
                }));
            }
        }
    }, [showMenu]);

    // スクロールイベントに基づいてメニュー位置を更新
    useEffect(() => {
        const handleScroll = () => {
            if (yourComponentRef.current && menuContainerRef.current && showMenu) {
                const currentScrollTop = yourComponentRef.current.scrollTop;
                const scrollDiff = currentScrollTop - prevScrollTop.current;
                // スクロール方向に関わらずメニューの位置を更新
                setMenuPosition((prevPosition) => ({
                    ...prevPosition,
                    top: prevPosition.top - scrollDiff,
                }));
                // スクロールの現在位置を更新
                prevScrollTop.current = currentScrollTop;
            }
        };
        // スクロールイベントの監視を追加
        if (yourComponentRef.current) {
            yourComponentRef.current.addEventListener('scroll', handleScroll);
        }
        return () => {
            // クリーンアップ
            if (yourComponentRef.current) {
                yourComponentRef.current.removeEventListener('scroll', handleScroll);
            }
        };
    }, [showMenu]);
    
    // どこか別の場所がクリックされたらメニューを閉じる
    useEffect(() => {
        const handleClickOutside = () => {
            setShowMenu(false);
            setSelectedConversationId(null);
        };
        // ページ全体のクリックイベントを監視
        document.addEventListener('click', handleClickOutside);
        // クリーンアップ
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);
    
    useEffect(() => {
        const getTitleByConversationId = (conversationId: string) => {
            // conversationsDataが存在するかチェック
            if (conversationsData && conversationsData.conversations) {
                // conversations配列の中で指定されたconversation_idと一致するものを探す
                const conversation = conversationsData.conversations.find(conv => conv.conversation_id === conversationId);
                // 一致する会話があればそのtitleを返す
                if (conversation) {
                    return conversation.title;
                }
            }
            // 見つからなかった場合、undefinedを返す
            return null;
        };
        let title = null;
        if(selectedConversationId) {
            title = getTitleByConversationId(selectedConversationId);
        }
        setCelectConversationTitle(title)
    }, [selectedConversationId]);
    
    const makeApiRequest = async (loginUser: string) => {
        try {
            const result = await getConversationsHistoryApi(loginUser);
            setConversationsData(result)
        } catch (e) {
            console.error(e);
        }
    }

    // グループ名を取得する関数
    function getGroupName(dateString: string) {
        const inputDate = new Date(
            parseInt(dateString.slice(0, 4)),  // 年
            parseInt(dateString.slice(4, 6)) - 1,  // 月 (0から始まるので1引く)
            parseInt(dateString.slice(6, 8))   // 日
        );

        const today = new Date();
        const diffTime = today.getTime() - inputDate.getTime();  // 日付の差をミリ秒で計算
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // ミリ秒を日数に変換

        // 今日の年月を取得
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        if (diffDays === 0) return "今日";
        if (diffDays === 1) return "昨日";
        if (diffDays <= 7) return "過去7日間";
        if (diffDays <= 30) return "過去30日間";
        const yearDiff = currentYear - inputDate.getFullYear();
        // 1年以内なら月ごとのグループ
        if (diffDays <= 365) {
            return yearDiff === 0 ? `${inputDate.getMonth() + 1}月` : `${inputDate.getFullYear()}年`;
        }
        // それ以降は年ごとのグループ
        return `${inputDate.getFullYear()}年`;
    }

    // グループ名の順序
    const groupOrder = [
        "今日", "昨日", "過去7日間", "過去30日間", 
        "12月", "11月", "10月", "9月", "8月", "7月", "6月", "5月", "4月", "3月", "2月", "1月",
        "2029年", "2028年", "2027年", "2026年", "2025年", "2024年", "2023年",
        "日付なし"
    ];

    // timestamp でグループ化
    const groupedConversations = conversationsData && conversationsData.conversations.reduce((acc, conversation) => {
        let timestamp = conversation.timestamp;
        // timestampがnullの場合、"null"というグループを作成
        if (timestamp === null) {
            const nullGroupName = "日付なし";
            if (!acc[nullGroupName]) {
                acc[nullGroupName] = [];
            }
            acc[nullGroupName].push(conversation);
            return acc;
        }
        // timestampの日付部分 (YYYYMMDD) 
        const datePart = timestamp.slice(0, 8); // YYYYMMDD
        // グループ名を取得
        const groupName = getGroupName(datePart);
        // グループ名で会話を分類
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        // 会話にtimePartを追加して、その値で後でソートできるようにする
        acc[groupName].push(conversation);
        // timePartでソート
        acc[groupName].sort((a, b) => {
            const timeA = a.timestamp.slice(8);
            const timeB = b.timestamp.slice(8);
            return timeB.localeCompare(timeA);
        });
        return acc;
    }, {} as Record<string, Conversation[]>);

    // アプローチごとに分ける
    const chatGroup: Record<string, Conversation[]> = {};
    const docsearchGroup: Record<string, Conversation[]> = {};

    // groupedConversations を Chat と DocSearch に分類
    if (groupedConversations) {
        Object.keys(groupedConversations).forEach((groupName) => {
            const conversations = groupedConversations[groupName];
        
            // approach が "chat" のものを chatGroup に追加
            const chatConversations = conversations.filter(
                (conversation) => conversation.approach === "chat"
            );
            if (chatConversations.length > 0) {
                chatGroup[groupName] = chatConversations;
            }
        
            // approach が "docsearch" のものを docsearchGroup に追加
            const docsearchConversations = conversations.filter(
                (conversation) => conversation.approach === "docsearch"
            );
            if (docsearchConversations.length > 0) {
                docsearchGroup[groupName] = docsearchConversations;
            }
        });
    }

    const creatNewChat = (id: string) => {
        onClick(id);
        clearChat();
    }

    // メニューの表示・非表示を切り替える
    const handleShowMenu = (conversationId:string, event: MouseEvent<HTMLDivElement>) => {
        // クリック位置の座標を取得
        const buttonRect = event.currentTarget.getBoundingClientRect();
        
        // 既に開いていて、同じ会話のオプションをクリックした場合は閉じる
        if (showMenu && selectedConversationId === conversationId) {
            setShowMenu(false);
            setSelectedConversationId(null);
            return;
        }
        // メニューの位置を設定（絶対位置）
        const scrollTop = yourComponentRef.current ? yourComponentRef.current.scrollTop : 0;
        prevScrollTop.current = scrollTop;
        const menuTop = buttonRect.bottom + scrollTop;
        setMenuPosition({ top: menuTop - 20, left: buttonRect.left + 40 });
        // 対応するconversation_idを設定
        setSelectedConversationId(conversationId);
        // メニューを表示
        setShowMenu(true);
    };

    // 削除の確認をするモーダルを開く
    const openDeleteConfirmModal = () => {
        setIsOpenDeleteModal(!isOpenDeleteModal);
        setShowMenu(false);
    }
    // 削除確認モーダルを閉じる
    const closeDeleteConfirmModal = () => {
        setIsOpenDeleteModal(false);
    }
    // 削除ボタンが押されたときに指定したconversationを削除
    const handleDeleteConversation = async () => {
        setIsOpenDeleteModal(!isOpenDeleteModal);
        try {
            if (selectedConversationId) {
                // 削除処理を実行
                const result = await deleteConersationApi(selectedConversationId)
            }
        } catch (error) {
            console.error('Error handleDeleteConversation:', error);
        } finally {
            // メニューを閉じる
            setShowMenu(false);
            setSelectedConversationId(null);
            // 更新
            if (loginUser) {
                const result = await getConversationsHistoryApi(loginUser);
                // チャット削除時に新規チャットを開始
                creatNewChat("clearID")
                setConversationsData(result)
            }
        }
    };

    const navigate = useNavigate();

    const handleConversationClick = (conversationId: string, approach: string) => {
        if (approach === "docsearch") {
            navigate('/docsearch', { state: { conversationId, approach } });  // `approach`が`"docsearch"`ならページ遷移
        } else {
            navigate('/', { state: { conversationId, approach } });
        }
    };
    return (
        <>
            {showSidebar ? (
                <div className={styles.SideNav}>
                    <nav className={styles.SideNavContainer}>
                        <div className={styles.SideNavHeader}>
                            <div className={styles.SwitchgearBtnContainer}>
                                <button onClick={() => setShowSidebar(!showSidebar)}>
                                    <img src="./back_left.png" width={30} height={30} alt="back_left" />
                                </button>
                            </div>
                            <div className={styles.NewChatBtnContainer}>
                                <div onClick={() => creatNewChat("clearID")}>
                                    <img src="./new_chat.png" width={30} height={30} alt="new_chat" />
                                </div>
                                <div className={styles.NewChatexplanation}>
                                    <p>新しいチャット</p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.SideNavMain}>
                            {UserRole == "Lecturer" && (
                                <details className={styles.HistoryBox}>
                                    <summary className={styles.HistorySummary}>ChatGPT</summary>
                                    <div ref={yourComponentRef} className={styles.SideNavList}>
                                        {chatGroup && Object.entries(chatGroup)
                                            .sort((a, b) => {
                                                return groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0]);
                                            })
                                            .map(([timestamp, conversations], index) => (
                                            <div key={index} className={styles.ConversationHistoryContainer}>
                                                <div className={styles.HistoryGroupName}>
                                                    <span>{timestamp}</span>
                                                </div>
                                                <ol className={styles.HistoryTitles}>
                                                    {conversations.map((conversation, convIndex) => (
                                                        <li
                                                            key={convIndex}
                                                            className={`${styles.HistoryTitleContainer} ${conversationId === conversation.conversation_id || selectedConversationId === conversation.conversation_id ? styles.clicked : ""}`}
                                                            onClick={() => handleConversationClick(conversation.conversation_id, conversation.approach)}
                                                        >
                                                            <a>
                                                                <div className={styles.ChatTitle}>
                                                                    {conversation.title}
                                                                </div>
                                                            </a>
                                                            {UserRole == "Lecturer" && (
                                                                <div
                                                                    className={styles.HistoryOptionBtnContainer}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleShowMenu(conversation.conversation_id, e);
                                                                    }}
                                                                >
                                                                    <span className={styles.HistoryOptionBtn}></span>
                                                                </div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                            <details className={styles.HistoryBox}>
                                <summary className={styles.HistorySummary}>研修テキスト内FAQ</summary>
                                <div ref={yourComponentRef} className={styles.SideNavList}>
                                    {docsearchGroup && Object.entries(docsearchGroup)
                                        .sort((a, b) => {
                                            return groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0]);
                                        })
                                        .map(([timestamp, conversations], index) => (
                                        <div key={index} className={styles.ConversationHistoryContainer}>
                                            <div className={styles.HistoryGroupName}>
                                                <span>{timestamp}</span>
                                            </div>
                                            <ol className={styles.HistoryTitles}>
                                                {conversations.map((conversation, convIndex) => (
                                                    <li
                                                        key={convIndex}
                                                        className={`${styles.HistoryTitleContainer} ${conversationId === conversation.conversation_id || selectedConversationId === conversation.conversation_id ? styles.clicked : ""}`}
                                                        onClick={() => handleConversationClick(conversation.conversation_id, conversation.approach)}
                                                    >
                                                        <a>
                                                            <div className={styles.ChatTitle}>
                                                                {conversation.title}
                                                            </div>
                                                        </a>
                                                        {UserRole == "Lecturer" && (
                                                            <div
                                                                className={styles.HistoryOptionBtnContainer}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleShowMenu(conversation.conversation_id, e);
                                                                }}
                                                            >
                                                                <span className={styles.HistoryOptionBtn}></span>
                                                            </div>
                                                        )}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                        {showMenu && (
                            <div
                                ref={menuContainerRef}
                                className={styles.menucontainer}
                                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px`}}
                                onClick={(e) => e.stopPropagation()} // メニューをクリックしても閉じないようにする
                            >
                                <ol>
                                    <li onClick={openDeleteConfirmModal}>
                                        <div className={styles.deleteContainer}>
                                            <Delete24Regular />
                                            <Text>{"削除"}</Text>
                                        </div>
                                    </li>
                                    {/* <li>名前を変更する</li>
                                    <li>共有する</li>
                                    <li>なんかができたら</li>
                                    <li>いいですね</li> */}
                                </ol>
                            </div>
                        )}
                    </nav>
                    {isOpenDeleteModal && (
                        <div className={styles.DelModalContainer} onClick={closeDeleteConfirmModal}>
                            <div className={styles.DelModalBody} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.DelModalBox}>
                                    <div className={styles.DelModalHeaderContainer}>
                                        <div className={styles.DelModalHeader}>
                                            <p>チャットを削除しますか？</p>
                                        </div>
                                    </div>
                                    <div className={styles.DelModalMain}>
                                        <div className={styles.ConfirmMessage}>
                                            <p>{selectConversationTitle}を削除します。</p>
                                        </div>
                                        <div className={styles.DelModalFooter}>
                                            <div className={styles.cancelBtnContainer} onClick={closeDeleteConfirmModal}>
                                                <button>キャンセル</button>
                                            </div>
                                            <div className={styles.delBtnContainer} onClick={handleDeleteConversation}>
                                                <button>削除</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.CloseSideNav}>
                    <div className={styles.SwitchgearBtnContainer}>
                        <button onClick={() => setShowSidebar(!showSidebar)}>
                            <img src="./show_right.png" width={30} height={30} alt="show_right" />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}