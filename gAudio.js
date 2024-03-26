// gAudio.js
// How to use:
// var gong = gAudio.load("gong.mp3")
// document.onclick = () => gAudio.play(gong)

var gAudio = {
	sounds: [],
	globalVolume: 1,
	globalVolumeMusic: 1,
	// isMusic is optional for if you want to have a separate global volume for music only.
	load: function(filename, isMusic) {
		var sound = {volume: 1, filename: filename, isMusic}
		var context = this.context
		if(context) {
			var ajax = new XMLHttpRequest()
			ajax.open("GET", filename, true)
			ajax.responseType = "arraybuffer"
			
			ajax.onload = () => {
				context.decodeAudioData(
					ajax.response,
					(buffer) => sound.audioBuffer = buffer,
					console.error
				)
			}
			
			ajax.onerror = console.error
			
			ajax.send()
			
			this.sounds.push(sound)
		} else {
			console.error("No AudioContext found")
		}
		return sound
	},
	// pan is optional. A number from 0 to 1. 0=left speaker only. 1=right speak only.
	play: function(sound, pan) {
		// If the sound isn't loaded yet.
		if(!sound || !sound.audioBuffer || !this.context) {
			return false
		}
		
		// Do nothing if the whole game is muted. So that it won't stop the user's background podcast or whatever.
		var globalVolume = this.getGlobalVolume(sound.isMusic)
		if(!globalVolume) {
			return false
		}
		
		var source = this.context.createBufferSource()
		if(!source) {
			return false
		}

		source.buffer = sound.audioBuffer
		if(!source.start) {
			source.start = source.noteOn
			if(!source.start) {
				return false
			}
		}

		sound.gainNode = this.context.createGain()
		
		if(pan !== undefined) {
			sound.gainNode2 = this.context.createGain()
			
			var splitter = this.context.createChannelSplitter(2)
			
			this.changePan(sound, pan)
			
			source.connect(splitter, 0, 0)
			var merger = this.context.createChannelMerger(2)
			
			splitter.connect(sound.gainNode, 0)
			splitter.connect(sound.gainNode2, 0)
			
			sound.gainNode.connect(merger, 0, 0)
			sound.gainNode2.connect(merger, 0, 1)
			merger.connect(this.context.destination)
			
		} else {
			sound.gainNode.gain.value = globalVolume * sound.volume
			source.connect(sound.gainNode)
			sound.gainNode.connect(this.context.destination)
		}

		source.start(0)

		sound.playedTime = Date.now()
		return true
	},
	// In case you want to change the pan while it's playing. Only works if you passed a pan on play()
	changePan: function(sound, pan) {
		if(!sound || !sound.gainNode2) {
			return false
		}
		
		// Make sure 1 of the speakers is always 100%. Scale the other one up proportionally.
		// Or else panned audio in the middle would be 50% on each speaker, thus half as loud as non-panned, which is 100% on each speaker.
		if(pan < .5) {
			var panLeft = 1
			var panRight = pan / (1 - pan)
		} else {
			var panLeft = (1 - pan) / pan
			var panRight = 1
		}
		
		var volume = sound.volume * this.getGlobalVolume(sound.isMusic)
		
		sound.gainNode.gain.value = volume * panLeft
		sound.gainNode2.gain.value = volume * panRight
	},
	stop: function(sound) {
		if(!sound) {
			return false
		}
		
		sound.playedTime = 0
		if(sound.gainNode)
			sound.gainNode.gain.value = 0
		if(sound.gainNode2)
			sound.gainNode2.gain.value = 0
	},
	stopAll: function(sound) {
		for(var sound of this.sounds) {
			this.stop(sound)
		}
	},
	// You can set volume before or while playing and it will stay that way.
	setVolume: function(sound, volume) {
		if(!sound) {
			return false
		}
		
		sound.volume = volume
		
		// Update the sound while it's playing.
		if(sound.playedTime) {
			if(sound.gainNode)
				sound.gainNode.gain.value = volume
			if(sound.gainNode2)
				sound.gainNode2.gain.value = volume
		}
	},
	getGlobalVolume: function(isMusic) {
		return isMusic ? this.globalVolume : this.globalVolumeMusic
	},
	setGlobalVolume: function(volume, isMusic) {
		if(isMusic) {
			this.globalVolume = volume
		} else {
			this.globalVolumeMusic = volume
		}
	},
	isPlaying: function(sound) {
		if(!sound) {
			return false
		}
		return sound.playedTime && sound.audioBuffer && Date.now() < sound.playedTime + sound.audioBuffer.duration * 1000
	},
	// Most browsers don't allow a sound to be played unless it has already been played inside a user action event.
	unlockAll: function() {
		if(!this.context) {
			return false
		}
		
		// When showing an admob video ad for example, all contexts get suspended. We need to resume them.
		if(this.context.state == 'suspended') {
			this.context.resume()
		}
		if(!this.unlocked && this.sounds.length) {
			this.unlocked = true
			for(sound of this.sounds) {
				if(!this.isPlaying(sound)) {
					this.play(sound)
					this.stop(sound)
				}
			}
			// You can set this callback to start playing your music as soon as the browser has unlocked the audio.
			if(this.onUnlocked) {
				this.onUnlocked()
			}
		}
	},
	// You may need to call this after you play a admob video ad in a WebView on native ios, because it won't let you resume the context for some reason.
	makeContext: function() {
		var context = window.AudioContext || window.webkitAudioContext
		if(context) {
			this.context = new context()
		}
	},
	setup: function() {
		document.addEventListener("touchend", this.unlockAll.bind(this))
		document.addEventListener("mouseup", this.unlockAll.bind(this))
		
		this.makeContext()

		document.addEventListener('visibilitychange', () => {
			if(document.hidden) {
				// Stop sounds when document hides.
				// It's annoying if your game keeps playing the music when you switched tab, or minimized safari on your iphone.
				this.stopAll()
			} else {
				// Recreate context after you get focus back.
				// This seems to be only necessary on native ios. After the user comes back to your app, the context looks fine but you won't hear anything until you make a new one.
				this.makeContext()
			}
		}, false)
	}
}

// You can move this to your window.onload if you want.
gAudio.setup()