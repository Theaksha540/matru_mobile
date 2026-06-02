import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';

const KeyboardSafeModal = ({
  visible,
  onRequestClose,
  children,
  position = 'bottom',
  keyboardGap = 5,
  overlayStyle,
  contentStyle,
  closeOnBackdropPress = true,
}) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [visibleKeyboard, setVisibleKeyboard] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setVisibleKeyboard(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setVisibleKeyboard(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleBackdropPress = () => {
    Keyboard.dismiss();
    if (closeOnBackdropPress && onRequestClose) {
      onRequestClose();
    }
  };

  // For bottom modals
  if (position === 'bottom') {
    const bottomOffset = visibleKeyboard ? keyboardHeight + keyboardGap : 0;
    
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onRequestClose}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={[styles.overlay, overlayStyle]}>
            <View style={[styles.bottomContainer, { marginBottom: bottomOffset }]}>
              <TouchableWithoutFeedback>
                <View style={[styles.bottomContent, contentStyle]}>{children}</View>
              </TouchableWithoutFeedback>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // For center modals (no keyboard offset needed)
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <KeyboardAvoidingView
          style={[styles.overlay, overlayStyle]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              styles.centerContainer,
              visibleKeyboard && styles.centerContainerKeyboardVisible,
              visibleKeyboard ? { paddingBottom: keyboardGap } : null,
            ]}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.centerContent, contentStyle]}>{children}</View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default KeyboardSafeModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 0,
    maxHeight: '85%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerContainerKeyboardVisible: {
    justifyContent: 'flex-start',
    paddingTop: 54,
  },
  centerContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  },
});
