from cdparser import Classifier
import argparse

parser = argparse.ArgumentParser(description='Label some city-directory entries!')
parser.add_argument('--training', help='path to training CSV file')

args = vars(parser.parse_args())
training_path = args['training']

if not training_path:
  raise ValueError('Please supply path to training data with the --training argument')

classifier = Classifier.Classifier()
classifier.load_training(training_path)
classifier.train()
classifier.listen()