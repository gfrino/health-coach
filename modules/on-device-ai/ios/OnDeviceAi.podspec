Pod::Spec.new do |s|
  s.name           = 'OnDeviceAi'
  s.version        = '1.0.0'
  s.summary        = 'On-device LLM (Apple Foundation Models)'
  s.description    = 'Wraps Apple Foundation Models for Health Coach. Weak-linked: the app still runs on iOS versions without it.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
