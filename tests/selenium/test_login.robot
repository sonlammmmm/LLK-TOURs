*** Settings ***
Library           SeleniumLibrary
Suite Setup       Open Browser To Login
Suite Teardown    Close All Browsers
Test Teardown     Run Keyword And Ignore Error    Capture Page Screenshot

*** Variables ***
${BASE_URL}             http://localhost:3000
${ADMIN_EMAIL}          admin@gmail.com
${ADMIN_PASSWORD}       12345678
${USER_EMAIL}           vannam.bui@example.com
${USER_PASSWORD}        slam7424
${BROWSER}              chrome
${WINDOW_WIDTH}         1280
${WINDOW_HEIGHT}        800
${LOGIN_URL}            ${BASE_URL}/login
${ADMIN_DASHBOARD_PATH}    /admin/dashboard

*** Keywords ***
Open Browser To Login
    Open Browser    ${LOGIN_URL}    ${BROWSER}
    Set Window Size    ${WINDOW_WIDTH}    ${WINDOW_HEIGHT}
    Wait Until Element Is Visible    id=email    10s
    Wait Until Element Is Visible    id=password    10s

Open Login
    Go To    ${LOGIN_URL}
    Wait Until Element Is Visible    id=email    10s
    Wait Until Element Is Visible    id=password    10s

Fill Login Form
    [Arguments]    ${email}    ${password}
    Clear Element Text    id=email
    Clear Element Text    id=password
    Run Keyword If    '${email}' != '${NONE}'    Input Text    id=email    ${email}
    Run Keyword If    '${password}' != '${NONE}'    Input Text    id=password    ${password}

Submit Login
    Click Button    css:form.form--login button.btn.auth-btn

Wait For Success Alert
    Wait Until Element Is Visible    css:.alert.alert--success    10s

Wait For Error Alert
    Wait Until Element Is Visible    css:.alert.alert--error    10s

Wait For Any Alert
    Wait Until Keyword Succeeds    10s    1s    Alert Should Be Visible

Alert Should Be Visible
    ${success}=    Run Keyword And Return Status    Element Should Be Visible    css:.alert.alert--success
    ${error}=    Run Keyword And Return Status    Element Should Be Visible    css:.alert.alert--error
    Should Be True    ${success} or ${error}

Get Alert Text
    [Arguments]    ${alert_type}
    ${text}=    Get Text    css:.alert.alert--${alert_type} .alert__message
    RETURN    ${text}

Current Url Should Contain
    [Arguments]    ${path_fragment}
    Wait Until Location Contains    ${path_fragment}    10s

Location Should Not Contain
    [Arguments]    ${path_fragment}
    ${current}=    Get Location
    Should Not Contain    ${current}    ${path_fragment}

Wait For Login Redirect
    Wait Until Keyword Succeeds    10s    1s    Location Should Not Contain    /login

Fail Login With Error
    ${error_text}=    Get Alert Text    error
    Fail    Dang nhap user that bai: ${error_text}

*** Test Cases ***
Dang nhap admin thanh cong
    Open Login
    Fill Login Form    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}
    Submit Login
    Wait For Success Alert
    Current Url Should Contain    ${ADMIN_DASHBOARD_PATH}

Dang nhap user thanh cong
    Open Login
    Fill Login Form    ${USER_EMAIL}    ${USER_PASSWORD}
    Submit Login
    ${has_error}=    Run Keyword And Return Status    Wait Until Element Is Visible    css:.alert.alert--error    2s
    Run Keyword If    ${has_error}    Fail Login With Error
    Wait For Login Redirect

Dang nhap thieu email
    Open Login
    Fill Login Form    ${EMPTY}    ${USER_PASSWORD}
    Submit Login
    ${message}=    Get Element Attribute    id=email    validationMessage
    Should Not Be Empty    ${message}
    Location Should Contain    /login

Dang nhap thieu mat khau
    Open Login
    Fill Login Form    ${USER_EMAIL}    ${EMPTY}
    Submit Login
    ${message}=    Get Element Attribute    id=password    validationMessage
    Should Not Be Empty    ${message}
    Location Should Contain    /login

Dang nhap sai mat khau
    Open Login
    Fill Login Form    ${USER_EMAIL}    wrong-password
    Submit Login
    Wait For Error Alert
    Location Should Contain    /login

Dang nhap email sai dinh dang
    Open Login
    Fill Login Form    notanemail    ${USER_PASSWORD}
    Submit Login
    ${message}=    Get Element Attribute    id=email    validationMessage
    Should Not Be Empty    ${message}
    Location Should Contain    /login
