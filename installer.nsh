!macro customInstaller
    # 브랜딩 텍스트 설정
    BrandingText "HEIMLICH® Studio"
    
    # 인스톨러 색상 설정
    !define MUI_BGCOLOR "121212"
    !define MUI_TEXTCOLOR "FFFFFF"
    
    # 인스톨러 폰트 설정
    !define MUI_FONT "Segoe UI"
    !define MUI_FONTSIZE "8"
    
    # 추가 UI 커스터마이징
    XPStyle on
    SetCompressor /SOLID lzma
    
    # 모던한 설치 프로그레스 바 스타일
    !define MUI_INSTALLCOLORS "FFFFFF 121212"
    !define MUI_PROGRESSBAR "smooth"
    
    # 설명 텍스트 커스터마이징
    !define MUI_WELCOMEPAGE_TITLE "RENAMER by HEIMLICH®"
    !define MUI_WELCOMEPAGE_TEXT "Advanced file renaming tool for creators.$\r$\n$\r$\nThis will install RENAMER by HEIMLICH® on your computer. Click Next to continue."
    
    # 완료 페이지 설정
    !define MUI_FINISHPAGE_RUN "$INSTDIR\RENAMER by HEIMLICH®.exe"
    !define MUI_FINISHPAGE_RUN_TEXT "Launch RENAMER by HEIMLICH®"
    !define MUI_FINISHPAGE_LINK "Visit HEIMLICH® Studio website"
    !define MUI_FINISHPAGE_LINK_LOCATION "https://heimlich.studio"
!macroend 