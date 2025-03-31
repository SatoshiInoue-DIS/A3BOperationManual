import { useState, useEffect } from "react";
import { msalInstance, loginRequest } from "./msalConfig";
import { useNavigate } from "react-router-dom";
import { getLoginInfo } from "../api";

export const useMsalAuth = async () => {
    const [loginUser, setLoginUser] = useState<{name: string, roles: string}>({name: "anonymous", roles: "none"});
    const navigate = useNavigate();

    useEffect(() => {
        const initializeMsal = async () => {
            try {
                await msalInstance.initialize();
            } catch (error) {
                setLoginUser({
                    name: "anonymous", 
                    roles: "none",
                });
            }
        };
        const handleLogin = async () => {
            try {
                // MSALインスタンスの初期化を待つ
                await initializeMsal();
                // 1. handleRedirectPromise()を呼び出して、リダイレクト後のパラメータを処理
                const loginResponse = await msalInstance.handleRedirectPromise();

                if (loginResponse) {
                    // 2. アクセストークンを使用して、ユーザー情報を取得するなどの処理を行う
                    const accessToken = loginResponse.accessToken;
                    // トークンからログイン情報を取得
                    const response = await getLoginInfo(accessToken)
                    if (response) {
                        setLoginUser({
                            name: response.name || "anonymous",
                            roles: response.roles || "none",
                        })
                        // トークン処理後にクエリパラメータを削除する
                        navigate("/", { replace: true });
                    } else {
                        navigate("/nopermission", { replace: true });
                    }
                } else {
                    // トークンがない場合はログインを開始する
                    await msalInstance.loginRedirect(loginRequest);
                }
            } catch (error) {
                setLoginUser({
                    name: "anonymous",
                    roles: "none",
                });
            }
        };

        handleLogin();
        // 上のコメントアウトを復活させて下のsetLoginUser("");を消す
        // setLoginUser({
        //     name: "anonymous",
        //     roles: "Lecturer",
        // });
    }, []);

    return loginUser;
};
