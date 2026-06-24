# 适用于普通Linux服务器与Docker镜像

#!/bin/bash

set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive

# ===== 超时参数 =====
APT_UPDATE_TIMEOUT=180
APT_INSTALL_TIMEOUT=1200
PIP_INSTALL_TIMEOUT=600
PIP_NETWORK_TIMEOUT=30
PIP_RETRIES=2

APT_MIRROR_ACTIVE=0
PIP_MIRROR_ACTIVE=0
APT_BACKUP_DIR=""
PIP_BACKUP_DIR=""

log() {
    echo ""
    echo "============================================"
    echo " $*"
    echo "============================================"
}

info() {
    echo "[INFO] $*"
}

warn() {
    echo "[WARN] $*" >&2
}

die() {
    echo "[ERROR] $*" >&2
    exit 1
}

# Docker 容器中通常是 root；如果不是 root，使用 sudo -n，避免远程脚本卡在密码输入。
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO=(sudo -n)
    else
        die "当前用户不是 root，且系统没有 sudo，无法安装 apt 依赖。"
    fi
else
    SUDO=()
fi

on_exit() {
    local code=$?
    set +e

    if [ "$PIP_MIRROR_ACTIVE" = "1" ]; then
        restore_pip_conf
    fi

    if [ "$APT_MIRROR_ACTIVE" = "1" ]; then
        restore_apt_sources
    fi

    if [ "$code" -eq 0 ]; then
        echo ""
        echo "============================================"
        echo " ✅ 全部依赖安装完成！"
        echo "============================================"
    else
        echo "" >&2
        echo "============================================" >&2
        echo " ❌ 依赖安装失败，退出码：$code" >&2
        echo " 请检查上方 [ERROR]/[WARN] 日志；如果默认源和华为源都失败，通常是容器网络/DNS/代理不可达。" >&2
        echo "============================================" >&2
    fi

    exit "$code"
}
trap on_exit EXIT

run_with_timeout() {
    local seconds="$1"
    shift

    if command -v timeout >/dev/null 2>&1; then
        timeout --kill-after=10s "${seconds}s" "$@"
    else
        "$@"
    fi
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "缺少必要命令：$1"
}

APT_OPTS=(
    -o Acquire::Retries=2
    -o Acquire::http::Timeout=30
    -o Acquire::https::Timeout=30
    -o Acquire::ftp::Timeout=30
    -o DPkg::Lock::Timeout=60
)

APT_PACKAGES=(
    ca-certificates
    libssl-dev
    bison
    flex
    autoconf
    automake
    libtool
    device-tree-compiler
    pkg-config
    m4
    openjdk-11-jdk
    mtd-utils
    u-boot-tools
    python3-pip
    cmake
    unzip
    zip
    locales
    language-pack-en-base
    bc
    libelf-dev
    fakeroot
    squashfs-tools
    ccache
)

PIP_PACKAGES=(
    prettytable
    pyelftools
    pycryptodome
    gmssl
)

apt_clean() {
    run_with_timeout 120 "${SUDO[@]}" apt-get clean || true
    "${SUDO[@]}" rm -rf /var/lib/apt/lists/*
}

apt_update() {
    run_with_timeout "$APT_UPDATE_TIMEOUT" \
        "${SUDO[@]}" apt-get "${APT_OPTS[@]}" update
}

apt_install() {
    run_with_timeout "$APT_INSTALL_TIMEOUT" \
        "${SUDO[@]}" apt-get "${APT_OPTS[@]}" install -y --no-install-recommends "${APT_PACKAGES[@]}"
}

backup_apt_sources() {
    if [ -n "$APT_BACKUP_DIR" ]; then
        return 0
    fi

    APT_BACKUP_DIR="$(mktemp -d /tmp/apt-sources-backup.XXXXXX)"

    if [ -f /etc/apt/sources.list ]; then
        cp -a /etc/apt/sources.list "$APT_BACKUP_DIR/sources.list"
    else
        touch "$APT_BACKUP_DIR/NO_sources.list"
    fi

    if [ -d /etc/apt/sources.list.d ]; then
        mkdir -p "$APT_BACKUP_DIR/sources.list.d"
        cp -a /etc/apt/sources.list.d/. "$APT_BACKUP_DIR/sources.list.d/" 2>/dev/null || true
    else
        touch "$APT_BACKUP_DIR/NO_sources.list.d"
    fi
}

restore_apt_sources() {
    info "恢复原 apt 源配置..."

    "${SUDO[@]}" rm -f /etc/apt/sources.list
    "${SUDO[@]}" rm -rf /etc/apt/sources.list.d
    "${SUDO[@]}" mkdir -p /etc/apt/sources.list.d

    if [ -f "$APT_BACKUP_DIR/sources.list" ]; then
        "${SUDO[@]}" cp -a "$APT_BACKUP_DIR/sources.list" /etc/apt/sources.list
    fi

    if [ -d "$APT_BACKUP_DIR/sources.list.d" ]; then
        "${SUDO[@]}" cp -a "$APT_BACKUP_DIR/sources.list.d/." /etc/apt/sources.list.d/ 2>/dev/null || true
    fi

    rm -rf "$APT_BACKUP_DIR"
}

activate_huawei_apt_mirror() {
    if [ "$APT_MIRROR_ACTIVE" = "1" ]; then
        return 0
    fi

    backup_apt_sources
    APT_MIRROR_ACTIVE=1

    local codename="jammy"
    if [ -r /etc/os-release ]; then
        . /etc/os-release
        codename="${VERSION_CODENAME:-jammy}"
    fi

    warn "切换到华为 apt 源重试，Ubuntu codename=$codename。脚本退出时会自动恢复原配置。"

    "${SUDO[@]}" rm -rf /etc/apt/sources.list.d
    "${SUDO[@]}" mkdir -p /etc/apt/sources.list.d

    cat <<EOF | "${SUDO[@]}" tee /etc/apt/sources.list >/dev/null
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename} main restricted
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-updates main restricted
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename} universe
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-updates universe
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename} multiverse
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-updates multiverse
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-backports main restricted universe multiverse
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-security main restricted
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-security universe
deb http://mirrors.tools.huawei.com/ubuntu/ ${codename}-security multiverse
EOF
}

backup_pip_conf() {
    if [ -n "$PIP_BACKUP_DIR" ]; then
        return 0
    fi

    PIP_BACKUP_DIR="$(mktemp -d /tmp/pip-conf-backup.XXXXXX)"

    if [ -f /etc/pip.conf ]; then
        cp -a /etc/pip.conf "$PIP_BACKUP_DIR/pip.conf"
    else
        touch "$PIP_BACKUP_DIR/NO_pip.conf"
    fi
}

restore_pip_conf() {
    info "恢复原 pip 配置..."

    if [ -f "$PIP_BACKUP_DIR/pip.conf" ]; then
        "${SUDO[@]}" cp -a "$PIP_BACKUP_DIR/pip.conf" /etc/pip.conf
    else
        "${SUDO[@]}" rm -f /etc/pip.conf
    fi

    rm -rf "$PIP_BACKUP_DIR"
}

activate_huawei_pip_mirror() {
    if [ "$PIP_MIRROR_ACTIVE" = "1" ]; then
        return 0
    fi

    backup_pip_conf
    PIP_MIRROR_ACTIVE=1

    warn "切换到华为 PyPI 源重试。脚本退出时会自动恢复原配置。"

    "${SUDO[@]}" mkdir -p /etc/pip
    cat <<'EOF' | "${SUDO[@]}" tee /etc/pip.conf >/dev/null
[global]
index-url = http://mirrors.tools.huawei.com/pypi/simple
trusted-host = mirrors.tools.huawei.com
timeout = 120
EOF
}

get_pip_extra_args() {
    PIP_EXTRA_ARGS=()

    local externally_managed="False"
    externally_managed="$(
        python3 -c 'import os,sysconfig; print(os.path.exists(os.path.join(sysconfig.get_path("stdlib"),"EXTERNALLY-MANAGED")))' 2>/dev/null || echo False
    )"

    if [ "$externally_managed" = "True" ]; then
        if python3 -m pip help install 2>/dev/null | grep -q -- '--break-system-packages'; then
            warn "检测到 externally-managed-environment，将使用 --break-system-packages。"
            PIP_EXTRA_ARGS+=(--break-system-packages)
        else
            warn "检测到 externally-managed-environment，但当前 pip 不支持 --break-system-packages；如果 pip 安装失败，请考虑换基础镜像或改用 venv。"
        fi
    fi
}

pip_install() {
    run_with_timeout "$PIP_INSTALL_TIMEOUT" \
        python3 -m pip install \
        --no-cache-dir \
        --timeout "$PIP_NETWORK_TIMEOUT" \
        --retries "$PIP_RETRIES" \
        "${PIP_EXTRA_ARGS[@]}" \
        "${PIP_PACKAGES[@]}"
}

require_command apt-get

log "[1/4] 清理 apt 缓存"
apt_clean

log "[2/4] 更新 apt 软件包索引：默认源"
if ! apt_update; then
    warn "默认 apt 源更新失败，准备切换华为 apt 源重试。"
    activate_huawei_apt_mirror

    log "[2/4] 更新 apt 软件包索引：华为源"
    apt_clean
    if ! apt_update; then
        die "默认 apt 源和华为 apt 源均无法完成 apt update。请检查 Docker 容器网络、DNS、代理或镜像源可达性。"
    fi
fi

log "[3/4] 安装 apt 软件包"
if ! apt_install; then
    if [ "$APT_MIRROR_ACTIVE" != "1" ]; then
        warn "默认 apt 源安装失败，准备切换华为 apt 源重试。"
        activate_huawei_apt_mirror

        log "[3/4] 安装 apt 软件包：华为源"
        apt_clean
        if ! apt_update; then
            die "切换华为 apt 源后 apt update 仍失败，停止安装。"
        fi
    else
        warn "当前已经在使用华为 apt 源。"
    fi

    if ! apt_install; then
        die "apt 软件包安装失败。可能是网络不可达、包名不兼容、Ubuntu 版本不匹配或源不可用。"
    fi
fi

log "[4/4] 安装 pip 软件包：默认 PyPI 源"
require_command python3
require_command pip3
get_pip_extra_args

if ! pip_install; then
    warn "默认 PyPI 源安装失败，准备切换华为 PyPI 源重试。"
    activate_huawei_pip_mirror

    log "[4/4] 安装 pip 软件包：华为 PyPI 源"
    if ! pip_install; then
        die "默认 PyPI 源和华为 PyPI 源均无法安装 Python 依赖。请检查 Docker 容器网络、DNS、代理或镜像源可达性。"
    fi
fi

# 减小 Docker 镜像体积；即使清理失败，也不影响依赖安装结果。
apt_clean || true