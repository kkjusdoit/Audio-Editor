class AudioEditor {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.currentPlayStart = 0;
        this.currentPlayDuration = undefined;
        
        // 选区
        this.selectionStart = null;
        this.selectionEnd = null;
        this.isSelecting = false;
        this.isDraggingStart = false;  // 是否正在拖拽开始位置
        this.isDraggingEnd = false;    // 是否正在拖拽结束位置
        this.edgeHitWidth = 6;         // 边界线的点击检测范围（像素）
        
        // Canvas
        this.canvas = document.getElementById('waveformCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 文件信息
        this.fileName = '';
        this.currentFileName = '';
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    setupEventListeners() {
        // 导入按钮
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('audioFile').click();
        });
        
        document.getElementById('audioFile').addEventListener('change', (e) => {
            this.loadAudioFile(e.target.files[0]);
        });
        
        // 播放控制
        document.getElementById('playBtn').addEventListener('click', () => this.play());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        
        // 导出按钮
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSelection());
        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAll());
        
        // Canvas 交互
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // 点击定位
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        if (this.audioBuffer) {
            this.drawWaveform();
        }
    }
    
    async loadAudioFile(file) {
        if (!file) return;
        
        this.fileName = file.name;
        this.currentFileName = file.name;
        document.getElementById('fileName').textContent = this.fileName;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            
            // 创建 AudioContext
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // 解码音频
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // 显示时长
            const duration = this.formatTime(this.audioBuffer.duration);
            document.getElementById('duration').textContent = duration;
            
            // 显示控制面板
            document.getElementById('audioInfo').style.display = 'flex';
            document.getElementById('playbackControls').style.display = 'flex';
            document.getElementById('exportControls').style.display = 'flex';
            document.getElementById('placeholder').style.display = 'none';
            
            // 绘制波形
            this.drawWaveform();
            
            // 重置选区
            this.selectionStart = null;
            this.selectionEnd = null;
            this.updateSelectionInfo();
            
        } catch (error) {
            console.error('加载音频失败:', error);
            alert('加载音频失败，请确保文件格式正确！');
        }
    }
    
    drawWaveform() {
        if (!this.audioBuffer) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 清空画布
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, width, height);
        
        // 绘制选区背景
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            const startX = (this.selectionStart / this.audioBuffer.duration) * width;
            const endX = (this.selectionEnd / this.audioBuffer.duration) * width;
            
            this.ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
            this.ctx.fillRect(startX, 0, endX - startX, height);
        }
        
        // 获取音频数据
        const channelData = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;
        
        // 绘制波形
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const index = i * step + j;
                if (index < channelData.length) {
                    const datum = channelData[index];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }
            
            const y1 = (1 + min) * amp;
            const y2 = (1 + max) * amp;
            
            this.ctx.moveTo(i, y1);
            this.ctx.lineTo(i, y2);
        }
        
        this.ctx.stroke();
        
        // 绘制中心线
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        
        // 绘制选区边界线（在波形之后，确保不被遮挡）
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            const startX = (this.selectionStart / this.audioBuffer.duration) * width;
            const endX = (this.selectionEnd / this.audioBuffer.duration) * width;
            
            // 绘制可拖拽的边界线（红色，加粗）
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 4;
            
            // 开始位置边界线
            this.ctx.beginPath();
            this.ctx.moveTo(startX, 0);
            this.ctx.lineTo(startX, height);
            this.ctx.stroke();
            
            // 结束位置边界线
            this.ctx.beginPath();
            this.ctx.moveTo(endX, 0);
            this.ctx.lineTo(endX, height);
            this.ctx.stroke();
        }
        
        // 绘制播放位置
        if (this.isPlaying) {
            const elapsed = this.audioContext.currentTime - this.startTime;
            const progress = elapsed / this.audioBuffer.duration;
            const x = progress * width;
            
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }
    
    onMouseDown(e) {
        if (!this.audioBuffer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = (x / this.canvas.width) * this.audioBuffer.duration;
        
        // 检查是否点击在现有选区的边界线上
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            const startX = (this.selectionStart / this.audioBuffer.duration) * this.canvas.width;
            const endX = (this.selectionEnd / this.audioBuffer.duration) * this.canvas.width;
            
            // 检查是否点击在开始位置边界线附近（整条线都可以点击）
            if (Math.abs(x - startX) <= this.edgeHitWidth) {
                this.isDraggingStart = true;
                this.canvas.style.cursor = 'ew-resize';
                return;
            }
            
            // 检查是否点击在结束位置边界线附近（整条线都可以点击）
            if (Math.abs(x - endX) <= this.edgeHitWidth) {
                this.isDraggingEnd = true;
                this.canvas.style.cursor = 'ew-resize';
                return;
            }
            
            // 检查是否点击在选区内部（保持选区不变）
            if (time >= this.selectionStart && time <= this.selectionEnd) {
                return; // 点击在选区内部，不做任何操作
            }
        }
        
        // 点击在选区外部，创建新选区
        this.isSelecting = true;
        this.selectionStart = time;
        this.selectionEnd = time;
        
        this.drawWaveform();
    }
    
    onMouseMove(e) {
        if (!this.audioBuffer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = Math.max(0, Math.min(this.audioBuffer.duration, (x / this.canvas.width) * this.audioBuffer.duration));
        
        // 如果正在拖拽开始位置手柄
        if (this.isDraggingStart) {
            // 确保不超过结束位置
            if (time < this.selectionEnd) {
                this.selectionStart = time;
            }
            this.drawWaveform();
            this.updateSelectionInfo();
            return;
        }
        
        // 如果正在拖拽结束位置手柄
        if (this.isDraggingEnd) {
            // 确保不小于开始位置
            if (time > this.selectionStart) {
                this.selectionEnd = time;
            }
            this.drawWaveform();
            this.updateSelectionInfo();
            return;
        }
        
        // 如果正在创建新选区
        if (this.isSelecting) {
            this.selectionEnd = time;
            this.drawWaveform();
            this.updateSelectionInfo();
            return;
        }
        
        // 鼠标悬停时改变光标样式
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            const startX = (this.selectionStart / this.audioBuffer.duration) * this.canvas.width;
            const endX = (this.selectionEnd / this.audioBuffer.duration) * this.canvas.width;
            
            // 检查是否悬停在边界线上
            if (Math.abs(x - startX) <= this.edgeHitWidth || Math.abs(x - endX) <= this.edgeHitWidth) {
                this.canvas.style.cursor = 'ew-resize';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    onMouseUp(e) {
        if (!this.audioBuffer) return;
        
        // 重置拖拽状态
        if (this.isDraggingStart) {
            this.isDraggingStart = false;
            this.canvas.style.cursor = 'crosshair';
            this.drawWaveform();
            this.updateSelectionInfo();
            return;
        }
        
        if (this.isDraggingEnd) {
            this.isDraggingEnd = false;
            this.canvas.style.cursor = 'crosshair';
            this.drawWaveform();
            this.updateSelectionInfo();
            return;
        }
        
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        
        // 确保 start < end
        if (this.selectionStart > this.selectionEnd) {
            [this.selectionStart, this.selectionEnd] = [this.selectionEnd, this.selectionStart];
        }
        
        // 如果选区太小，清除选区
        if (Math.abs(this.selectionEnd - this.selectionStart) < 0.1) {
            this.selectionStart = null;
            this.selectionEnd = null;
        }
        
        this.drawWaveform();
        this.updateSelectionInfo();
    }
    
    onCanvasClick(e) {
        if (!this.audioBuffer || this.isSelecting || this.isDraggingStart || this.isDraggingEnd) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / this.canvas.width) * this.audioBuffer.duration;
        
        // 如果点击在选区内部，不做任何操作
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            if (time >= this.selectionStart && time <= this.selectionEnd) {
                return;
            }
        }
        
        // 点击在选区外部，定位播放位置
        if (this.isPlaying) {
            this.stop();
            this.play(time);
        }
    }
    
    updateSelectionInfo() {
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            document.getElementById('selectionStart').textContent = this.formatTime(this.selectionStart);
            document.getElementById('selectionEnd').textContent = this.formatTime(this.selectionEnd);
            document.getElementById('selectionDuration').textContent = 
                this.formatTime(Math.abs(this.selectionEnd - this.selectionStart));
            document.getElementById('selectionInfo').style.display = 'flex';
        } else {
            document.getElementById('selectionInfo').style.display = 'none';
        }
    }
    
    play(startTime = null) {
        if (!this.audioBuffer) return;
        
        this.stop();
        
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.audioContext.destination);
        
        // 如果有选中片段，只播放选中的部分
        let playStart = startTime;
        let playDuration = undefined;
        
        if (this.selectionStart !== null && this.selectionEnd !== null && startTime === null) {
            // 有选区且没有指定起始时间，从选区开始播放
            playStart = this.selectionStart;
            playDuration = this.selectionEnd - this.selectionStart;
        } else if (startTime === null) {
            // 没有选区也没有指定时间，从头播放
            playStart = 0;
        }
        
        this.startTime = this.audioContext.currentTime - playStart;
        
        // 如果有播放时长限制，使用 start(when, offset, duration)
        if (playDuration !== undefined) {
            this.sourceNode.start(0, playStart, playDuration);
        } else {
            this.sourceNode.start(0, playStart);
        }
        
        this.isPlaying = true;
        this.currentPlayStart = playStart;
        this.currentPlayDuration = playDuration;
        
        document.getElementById('playBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';
        
        // 更新播放位置
        this.updatePlaybackPosition();
        
        // 播放结束回调
        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };
    }
    
    pause() {
        if (!this.isPlaying) return;
        
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.stop();
        
        document.getElementById('playBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
    }
    
    stop() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        this.isPlaying = false;
        this.pauseTime = 0;
        this.currentPlayStart = 0;
        this.currentPlayDuration = undefined;
        
        document.getElementById('playBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        
        this.drawWaveform();
    }
    
    updatePlaybackPosition() {
        if (!this.isPlaying) return;
        
        const elapsed = this.audioContext.currentTime - this.startTime;
        
        // 如果播放的是选中片段，且超过了片段长度，停止播放
        if (this.currentPlayDuration !== undefined && 
            elapsed >= this.currentPlayStart + this.currentPlayDuration) {
            this.stop();
            return;
        }
        
        document.getElementById('currentTime').textContent = this.formatTime(elapsed);
        
        this.drawWaveform();
        requestAnimationFrame(() => this.updatePlaybackPosition());
    }
    
    async exportSelection() {
        if (!this.audioBuffer || this.selectionStart === null || this.selectionEnd === null) {
            alert('请先选择要导出的音频片段！');
            return;
        }
        
        try {
            const startSample = Math.floor(this.selectionStart * this.audioBuffer.sampleRate);
            const endSample = Math.floor(this.selectionEnd * this.audioBuffer.sampleRate);
            const length = endSample - startSample;
            
            // 创建新的 AudioBuffer
            const exportBuffer = this.audioContext.createBuffer(
                this.audioBuffer.numberOfChannels,
                length,
                this.audioBuffer.sampleRate
            );
            
            // 复制选中的音频数据
            for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
                const channelData = this.audioBuffer.getChannelData(channel);
                const exportData = exportBuffer.getChannelData(channel);
                
                for (let i = 0; i < length; i++) {
                    exportData[i] = channelData[startSample + i];
                }
            }
            
            // 导出为 WAV
            await this.downloadAudio(exportBuffer, 'audio_clip.wav');
            
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败！');
        }
    }
    
    async exportAll() {
        if (!this.audioBuffer) {
            alert('请先导入音频文件！');
            return;
        }
        
        try {
            await this.downloadAudio(this.audioBuffer, this.currentFileName || 'audio_export.wav');
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败！');
        }
    }
    
    async downloadAudio(audioBuffer, fileName) {
        // 将 AudioBuffer 转换为 WAV
        const wav = this.audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        
        // 下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace(/\.[^/.]+$/, '') + '.wav';
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    audioBufferToWav(buffer) {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;
        
        // 写入 WAV 文件头
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };
        
        // "RIFF"
        setUint32(0x46464952);
        // 文件长度
        setUint32(length - 8);
        // "WAVE"
        setUint32(0x45564157);
        // "fmt "
        setUint32(0x20746d66);
        // fmt chunk length
        setUint32(16);
        // format (PCM)
        setUint16(1);
        // channels
        setUint16(buffer.numberOfChannels);
        // sample rate
        setUint32(buffer.sampleRate);
        // byte rate
        setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
        // block align
        setUint16(buffer.numberOfChannels * 2);
        // bits per sample
        setUint16(16);
        // "data"
        setUint32(0x61746164);
        // data chunk length
        setUint32(length - pos - 4);
        
        // 写入音频数据
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        
        return arrayBuffer;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new AudioEditor();
});

